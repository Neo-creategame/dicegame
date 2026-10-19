/**
 * js/network.js
 * PeerJSを使用した通信対戦・状態同期ロジック
 */

// --- 部屋の作成（ホスト側）またはシングルプレイの開始 ---
function startSingleOrHostGame() {
  const p2Type = document.getElementById("p2-type").value;
  const p3Type = document.getElementById("p3-type").value;
  const p4Type = document.getElementById("p4-type").value;

  cpuLevel = document.getElementById("cpu-level-select").value;
  gameMode = document.getElementById("game-mode-select").value;

  const startMoney = (gameMode === "3years") ? 5000 : 1500;
  const types = ["human", p2Type, p3Type, p4Type].filter(t => t !== "none");

  if (types.length < 2) {
    alert("最低2人以上のプレイヤーを設定してください。");
    return;
  }

  // テンプレート安全割当
  const assignedTemplates = ["p1", "p2", p3Type !== "none" ? "p3" : "p4", "p4"];
  players = types.map((type, idx) => {
    const targetId = assignedTemplates[idx] || ALL_PLAYER_TEMPLATES[idx].id;
    const template = ALL_PLAYER_TEMPLATES.find(t => t.id === targetId) || ALL_PLAYER_TEMPLATES[idx];

    return {
      ...template,
      isCpu: (type === "cpu"),
      money: startMoney,
      position: 0,
      cards: [],
      lastPosition: null
    };
  });

  const hasRemoteHuman = types.slice(1).some(t => t === "human");

  if (hasRemoteHuman) {
    const status = document.getElementById("lobby-status");
    if (status) status.innerText = "オンライン対戦部屋を作成中...";
    peer = new Peer();

    peer.on('open', (id) => {
      myPlayerId = 'p1';
      if (status) {
        status.innerHTML = `部屋作成成功！<br>対戦相手に以下のIDを伝えてください：<br><span style="font-size:18px; color:#1e88e5;">${id}</span><br>参加を待っています...`;
      }
    });

    peer.on('connection', (conn) => {
      connections.push(conn);

      const handleConnect = () => {
        const assignedIdx = connections.length;
        const assignedPlayer = players[assignedIdx] || players[1];

        conn.send({ type: 'ASSIGN_ROLE', payload: { playerId: assignedPlayer.id } });
        
        const lobbyModal = document.getElementById("lobby-modal");
        if (lobbyModal) lobbyModal.style.display = "none";
        initHostGame();
      };

      if (conn.open) {
        handleConnect();
      } else {
        conn.on('open', handleConnect);
      }

      conn.on('data', (data) => handleRemoteData(data));
      conn.on('close', () => {
        console.log("ゲストが切断しました");
      });
    });
  } else {
    myPlayerId = 'p1';
    const lobbyModal = document.getElementById("lobby-modal");
    if (lobbyModal) lobbyModal.style.display = "none";
    initHostGame();
  }
}

// --- 部屋への参加（ゲスト側） ---
function joinRoom() {
  const roomInput = document.getElementById("join-room-id");
  const roomId = roomInput ? roomInput.value.trim() : "";
  const status = document.getElementById("lobby-status");

  if (!roomId) {
    alert("部屋IDを入力してください");
    return;
  }

  if (status) status.innerText = "接続中...";
  peer = new Peer();

  peer.on('open', () => {
    const conn = peer.connect(roomId);
    connections = [conn];

    conn.on('open', () => {
      if (status) status.innerText = "接続成功！ホストからの開始を待っています...";
    });

    conn.on('data', (data) => handleRemoteData(data));
  });

  peer.on('error', (err) => {
    console.error("PeerJSエラー:", err);
    if (status) status.innerText = "接続エラー: 部屋IDを確認してください。";
  });
}

// --- 全接続先へのデータ送信 ---
function sendData(type, payload = {}) {
  connections.forEach(conn => {
    if (conn && conn.open) conn.send({ type, payload });
  });
}

// --- ゲーム状態の一括同期（ホストのみ実行） ---
function syncGameState() {
  if (myPlayerId === 'p1') {
    const state = {
      players,
      currentPlayerIndex,
      currentYear,
      currentMonth,
      destinationId,
      bonbyOwner,
      canBuyProperties,
      gameMode,
      isGameOver,
      propertiesOwnerState: getPropertiesOwnerState()
    };
    sendData('SYNC_STATE', state);
  }
}

// --- 物件の所有者状態を抽出 ---
function getPropertiesOwnerState() {
  const state = {};
  board.forEach(tile => {
    if (tile.type === "station") {
      state[tile.id] = tile.properties.map(p => ({ id: p.id, owner: p.owner }));
    }
  });
  return state;
}

// --- 物件の所有者状態を反映 ---
function applyPropertiesOwnerState(state) {
  if (!state) return;
  board.forEach(tile => {
    if (tile.type === "station" && state[tile.id]) {
      state[tile.id].forEach(pState => {
        const prop = tile.properties.find(p => p.id === pState.id);
        if (prop) prop.owner = pState.owner;
      });
    }
  });
}

// --- リモートデータ受信ハンドラ ---
function handleRemoteData(data) {
  const { type, payload } = data;

  switch (type) {
    case 'ASSIGN_ROLE':
      myPlayerId = payload.playerId;
      const lobbyModal = document.getElementById("lobby-modal");
      if (lobbyModal) lobbyModal.style.display = "none";
      break;

    case 'SYNC_STATE':
      players = payload.players;
      currentPlayerIndex = payload.currentPlayerIndex;
      currentYear = payload.currentYear;
      currentMonth = payload.currentMonth;
      destinationId = payload.destinationId;
      bonbyOwner = payload.bonbyOwner;
      canBuyProperties = payload.canBuyProperties;
      gameMode = payload.gameMode || "3years";
      isGameOver = payload.isGameOver || false;
      applyPropertiesOwnerState(payload.propertiesOwnerState);

      const destTile = board.find(t => t.id === destinationId);
      if (destTile) {
        const destNameEl = document.getElementById("destination-name");
        const barDestNameEl = document.getElementById("bar-dest-name");
        if (destNameEl) destNameEl.innerText = `${destTile.name}駅`;
        if (barDestNameEl) barDestNameEl.innerText = `${destTile.name}駅`;
      }
      const dateDisp = document.getElementById("date-display");
      if (dateDisp) dateDisp.innerText = `${currentYear}年目 ${currentMonth}月`;

      renderBoard();
      updateControlsState();
      checkCpuTurnTrigger();
      break;

    case 'ACTION_ROLL_DICE':
      (async () => {
        const rollingPlayer = players.find(p => p.id === payload.playerId) || getCurrentPlayer();
        await show3DDiceAnimation(rollingPlayer.name, payload.diceCount, payload.diceResults);
        executeDiceRoll(payload.diceCount, payload.diceResults);
      })();
      break;

    case 'BRANCH_CHOSEN':
      if (branchResolve) {
        branchResolve(payload.nextTileId);
        branchResolve = null;
      }
      break;

    case 'BUY_PROPERTY':
      buyPropertyLocal(payload.stationId, payload.propertyId, payload.playerId);
      break;

    case 'NEXT_TURN':
      nextTurnLocal();
      break;

    case 'SHOW_KESSAN':
      if (payload.isQuarterly) execQuarterlyKessanLocal();
      else execKessanLocal();
      break;

    case 'CLOSE_KESSAN':
      closeKessanLocal();
      break;
      
    case 'SHOW_ALERT':
      alert(payload.text);
      break;

    case 'SET_MESSAGE':
      const msgEl = document.getElementById("message");
      if (msgEl) msgEl.innerText = payload.text;
      break;

    case 'USE_CARD':
      // 元コードの引数ズレ（カード同期のバグ）を修正
      useCardLocal(payload.playerId, payload.cardIndex);
      break;
  }
}
