/**
 * js/main.js
 * ゲーム全体の状態管理・ターン進行・UI制御・決算・イベント処理
 */

// --- グローバル状態変数 ---
let players = [];
let myPlayerId = "p1";
let peer = null;
let connections = [];
let isCpuProcessing = false;
let cpuLevel = "normal";
let gameMode = "3years";
let isGameOver = false;

let currentPlayerIndex = 0;
let currentYear = 1;  
let currentMonth = 4; 
let destinationId = null;
let bonbyOwner = null;
let canBuyProperties = false;
let isOverallMapView = false;
let branchResolve = null;

// --- 初期化・カメラ・表示設定 ---
function updatePlayerConfigs() {
  const p2 = document.getElementById("p2-type").value;
  const p3 = document.getElementById("p3-type").value;

  if (p2 === "none") {
    document.getElementById("p3-type").value = "none";
    document.getElementById("p4-type").value = "none";
  } else if (p3 === "none") {
    document.getElementById("p4-type").value = "none";
  }
}

function initHostGame() {
  setRandomStartPositions();
  setNextDestination();
  renderBoard();
  updateControlsState();
  syncGameState();
  checkCpuTurnTrigger();
}

function setRandomStartPositions() {
  const stations = board.filter(tile => tile.type === "station");
  const randomStation = stations[Math.floor(Math.random() * stations.length)];
  players.forEach(p => p.position = randomStation.id);
}

function getCurrentPlayer() {
  return players[currentPlayerIndex] || players[0];
}

function updateCameraPosition() {
  const outer = document.getElementById("map-outer");
  const container = document.getElementById("map");
  const headerBar = document.getElementById("overall-header");

  if (!outer || !container) return;

  if (isOverallMapView) {
    const mapWidth = 40 * (26 + 4) + 40;
    const mapHeight = 40 * (26 + 4) + 40;

    const scaleX = outer.clientWidth / mapWidth;
    const scaleY = outer.clientHeight / mapHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const offsetX = (outer.clientWidth - mapWidth * scale) / 2;
    const offsetY = (outer.clientHeight - mapHeight * scale) / 2;

    container.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    if (headerBar) headerBar.style.display = "flex";
  } else {
    const curPlayer = getCurrentPlayer();
    const currentTile = board.find(t => t.id === curPlayer.position) || board[0];

    const tileSize = 26 + 4;
    const tileCenterX = currentTile.x * tileSize + 13;
    const tileCenterY = currentTile.y * tileSize + 13;

    const outerCenterX = outer.clientWidth / 2;
    const outerCenterY = outer.clientHeight / 2;

    const offsetX = outerCenterX - (tileCenterX * 2.0);
    const offsetY = outerCenterY - (tileCenterY * 2.0);

    container.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(2.0)`;
    if (headerBar) headerBar.style.display = "none";
  }
}

function toggleMapView() {
  isOverallMapView = !isOverallMapView;
  const btn = document.getElementById("map-toggle-btn");
  if (btn) {
    if (isOverallMapView) {
      btn.innerText = "🔍 ズームイン";
      btn.style.background = "#2196F3";
    } else {
      btn.innerText = "🗺️ 全体マップを開く";
      btn.style.background = "#ff9800";
    }
  }
  updateCameraPosition();
}

function setNextDestination() {
  const stations = board.filter(tile => tile.type === "station");
  let newDest;
  do {
    const randomIndex = Math.floor(Math.random() * stations.length);
    newDest = stations[randomIndex];
  } while (destinationId !== null && newDest.id === destinationId);

  destinationId = newDest.id;
  const destNameEl = document.getElementById("destination-name");
  const barDestNameEl = document.getElementById("bar-dest-name");
  if (destNameEl) destNameEl.innerText = `${newDest.name}駅`;
  if (barDestNameEl) barDestNameEl.innerText = `${newDest.name}駅`;
}

function renderBoard() {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;
  mapContainer.innerHTML = "";

  board.forEach((tile) => {
    const tileDiv = document.createElement("div");
    tileDiv.className = `tile ${tile.type}`;
    tileDiv.style.gridColumn = tile.x + 1;
    tileDiv.style.gridRow = tile.y + 1;
    tileDiv.innerText = tile.name;
    tileDiv.onclick = () => showTileInfo(tile);

    if (tile.id === destinationId) {
      const badge = document.createElement("div");
      badge.className = "dest-badge";
      badge.innerText = "🎯 目的地";
      tileDiv.appendChild(badge);
    }

    players.forEach((p, idx) => {
      if (p.position === tile.id) {
        const pIcon = document.createElement("div");
        pIcon.className = `player-icon p-${idx}`;
        pIcon.innerText = p.icon;
        tileDiv.appendChild(pIcon);
      }
    });

    if (bonbyOwner !== null) {
      const bonbyPlayer = players.find(p => p.id === bonbyOwner);
      if (bonbyPlayer && tile.id === bonbyPlayer.position) {
        const bonbyIcon = document.createElement("div");
        bonbyIcon.className = "bonby-icon";
        bonbyIcon.innerText = "👹";
        tileDiv.appendChild(bonbyIcon);
      }
    }

    mapContainer.appendChild(tileDiv);
  });

  const statusContainer = document.getElementById("status-container");
  if (statusContainer) statusContainer.innerHTML = "";
  const barInfo = document.getElementById("bar-players-info");
  if (barInfo) barInfo.innerHTML = "";

  players.forEach((p, idx) => {
    const isActive = (idx === currentPlayerIndex);
    const card = document.createElement("div");
    card.className = `status-card ${isActive ? 'active' : ''}`;
    
    const isBonby = (bonbyOwner === p.id) ? "👹" : "";
    const cpuTag = p.isCpu ? "🤖" : "";

    card.innerHTML = `
      <div class="status-item">
        <span class="label" style="color:${p.color}">${p.icon} ${p.name} ${cpuTag} ${isBonby}</span>
        <span class="value" style="color:${p.color}">${p.money} 万円</span>
      </div>
      <small style="display:block; color:#666; font-size:10px;">カード: ${p.cards.map(c => c.name).join(", ") || "なし"}</small>
    `;
    if (statusContainer) statusContainer.appendChild(card);
    if (barInfo) barInfo.innerHTML += `<span style="color:${p.color}; font-weight:bold; margin-right:8px;">${p.icon}${p.money}万</span>`;
  });

  if (players.length > 0) {
    const curPlayer = getCurrentPlayer();
    const turnBanner = document.getElementById("turn-banner");
    if (turnBanner) {
      turnBanner.style.background = `linear-gradient(135deg, ${curPlayer.color}, #333)`;
      turnBanner.innerText = `👉 ${curPlayer.icon} ${curPlayer.name}${curPlayer.isCpu ? '(CPU)' : ''} のターン`;
    }
  }

  updateCameraPosition();
}

function updateControlsState() {
  const msgEl = document.getElementById("message");
  if (isGameOver) {
    document.getElementById("dice-btn").disabled = true;
    document.getElementById("card-btn").disabled = true;
    document.getElementById("next-btn").style.display = "none";
    if (msgEl) msgEl.innerText = "🏆 ゲーム終了です！お疲れ様でした！";
    return;
  }

  const curPlayer = getCurrentPlayer();
  const isMyTurn = (curPlayer.id === myPlayerId && !curPlayer.isCpu);

  const diceBtn = document.getElementById("dice-btn");
  const cardBtn = document.getElementById("card-btn");

  if (diceBtn) diceBtn.disabled = !isMyTurn;
  if (cardBtn) cardBtn.disabled = !isMyTurn || (curPlayer.cards.length === 0);

  if (msgEl) {
    if (curPlayer.isCpu) {
      msgEl.innerText = `🤖 ${curPlayer.name}(CPU) の思考中...`;
    } else if (isMyTurn) {
      msgEl.innerText = "あなたのターンです！操作を選択してください。";
    } else {
      msgEl.innerText = `${curPlayer.name} の操作を待っています...`;
    }
  }
}

// --- マス・物件購入 ---
function showTileInfo(tile) {
  const title = document.getElementById("panel-title");
  const content = document.getElementById("panel-content");
  const curPlayer = getCurrentPlayer();

  const isDestText = (tile.id === destinationId) ? " 🎯目的地" : "";
  if (title) title.innerText = `${tile.name} (${getTileTypeName(tile.type)})${isDestText}`;

  if (tile.type === "station") {
    let html = '<ul class="property-list">';
    tile.properties.forEach((prop) => {
      const isAtStation = (curPlayer.position === tile.id);
      const isMyTurn = (curPlayer.id === myPlayerId && !curPlayer.isCpu);
      const canBuy = isAtStation && canBuyProperties && isMyTurn && (prop.owner === null) && (curPlayer.money >= prop.price) && !isGameOver;

      html += `
        <li class="property-item">
          <div>
            <strong>🏠 ${prop.name}</strong><br>
            <small>${prop.price}万円 (収益率${prop.rate}%)</small>
          </div>
          <div>`;

      if (prop.owner !== null) {
        const ownerP = players.find(p => p.id === prop.owner);
        html += `<span class="owned-tag" style="color:${ownerP ? ownerP.color : '#333'}">✅ ${ownerP ? ownerP.name : ''}所有</span>`;
      } else if (isAtStation) {
        html += `<button class="buy-btn" ${canBuy ? "" : "disabled"} onclick="buyProperty(${tile.id}, ${prop.id}, '${curPlayer.id}')">購入する</button>`;
      } else {
        html += `<small style="color:#888;">(未購入)</small>`;
      }

      html += `</div></li>`;
    });
    html += '</ul>';
    if (content) content.innerHTML = html;
  } else {
    if (content) content.innerHTML = `<p>${getTileTypeName(tile.type)} のマスです。</p>`;
  }
}

function buyProperty(stationId, propertyId, playerId) {
  if (!canBuyProperties || isGameOver) return;
  
  buyPropertyLocal(stationId, propertyId, playerId);
  sendData('BUY_PROPERTY', { stationId, propertyId, playerId });
  syncGameState();
}

function buyPropertyLocal(stationId, propertyId, playerId) {
  const station = board.find(s => s.id === stationId);
  if (!station) return;
  const property = station.properties.find(p => p.id === propertyId);
  const purchasingPlayer = players.find(p => p.id === playerId) || getCurrentPlayer();

  if (property && purchasingPlayer.money >= property.price && property.owner === null) {
    purchasingPlayer.money -= property.price;
    property.owner = purchasingPlayer.id;

    renderBoard();
    const msgEl = document.getElementById("message");
    if (msgEl) msgEl.innerText = `🎉 ${purchasingPlayer.name} が ${property.name} を ${property.price}万円 で購入しました！`;
    showTileInfo(station);
  }
}

function getTileTypeName(type) {
  if (type === "station") return "物件駅";
  if (type === "blue") return "プラスマス";
  if (type === "red") return "マイナスマス";
  if (type === "yellow") return "カードマス";
  if (type === "event") return "イベントマス";
  if (type === "normal") return "ノーマルマス";
  if (type === "bonby") return "貧乏神マス";
  return "";
}

// --- カード処理（不具合修正済み） ---
function openCardModal() {
  if (getCurrentPlayer().id !== myPlayerId || isGameOver) return;

  const curPlayer = getCurrentPlayer();
  const body = document.getElementById("card-modal-body");

  if (curPlayer.cards.length === 0) {
    body.innerHTML = "<p>カードを持っていません。</p>";
  } else {
    let html = '<ul class="card-use-list">';
    curPlayer.cards.forEach((card, index) => {
      html += `
        <li class="card-use-item">
          <div>
            <strong>${card.name}</strong><br>
            <small style="color:#666;">${card.desc}</small>
          </div>
          <button style="background:#9c27b0; color:white; font-size:11px; padding:3px 8px;" onclick="useCard(${index})">使う</button>
        </li>`;
    });
    html += '</ul>';
    body.innerHTML = html;
  }

  document.getElementById("card-modal").style.display = "flex";
}

function closeCardModal() {
  document.getElementById("card-modal").style.display = "none";
}

async function useCard(cardIndex) {
  const curPlayer = getCurrentPlayer();
  if (curPlayer.cards.length <= cardIndex) return;
  closeCardModal();
  if (myPlayerId !== 'p1') {
    sendData('USE_CARD', { playerId: myPlayerId, cardIndex });
  } else {
    await useCardLocal(myPlayerId, cardIndex);
  }
}

async function useCardLocal(playerId, cardIndex) {
  const targetPlayer = players.find(p => p.id === playerId) || getCurrentPlayer();
  if (targetPlayer.cards.length <= cardIndex) return;

  const usedCard = targetPlayer.cards.splice(cardIndex, 1)[0];
    
  if (usedCard.id === "bonby") {
    bonbyOwner = targetPlayer.id;
    renderBoard();
    alert(`👹 ボンビーカードの効果！ ${targetPlayer.name} に貧乏神が取り憑いた！`);
    
    if (targetPlayer.id === myPlayerId && !targetPlayer.isCpu) {
      document.getElementById("dice-btn").style.display = "none";
      document.getElementById("card-btn").style.display = "none";
      document.getElementById("next-btn").style.display = "inline-block";
    }
  } else if (usedCard.id === "fly") {
    const randomTile = board[Math.floor(Math.random() * board.length)];
    targetPlayer.position = randomTile.id;
    renderBoard();

    const alertMsg = `🚀 【ぶっとびカード】発動！\n${targetPlayer.name} は ${randomTile.name || getTileTypeName(randomTile.type)} へ飛んで行った！`;
    if (myPlayerId === 'p1') sendData('SHOW_ALERT', { text: alertMsg });
    alert(alertMsg);

    checkBonbyPass();
    handleTileEffect(randomTile);
    showTileInfo(randomTile);
    syncGameState();

    if (targetPlayer.id === myPlayerId && !targetPlayer.isCpu) {
      document.getElementById("dice-btn").style.display = "none";
      document.getElementById("card-btn").style.display = "none";
      document.getElementById("next-btn").style.display = "inline-block";
    }
  } else if (usedCard.id === "takeover") {
    let targetProps = [];
    board.forEach(tile => {
      if (tile.type === "station") {
        tile.properties.forEach(p => {
          if (p.owner !== null && p.owner !== targetPlayer.id) {
            targetProps.push(p);
          }
        });
      }
    });

    if (targetProps.length > 0) {
      const stolen = targetProps[Math.floor(Math.random() * targetProps.length)];
      const prevOwner = players.find(p => p.id === stolen.owner);
      stolen.owner = targetPlayer.id;
      renderBoard();

      const alertMsg = `🏠 【乗っ取りカード】発動！\n${targetPlayer.name} は ${prevOwner ? prevOwner.name : '他社'} から【${stolen.name}】を横取りしました！`;
      if (myPlayerId === 'p1') sendData('SHOW_ALERT', { text: alertMsg });
      alert(alertMsg);
    } else {
      alert("横取りできる他人の物件がありませんでした…カードだけ消滅しました。");
    }
    syncGameState();
  } else if (usedCard.id === "tokusei") {
    let count = 0;
    players.forEach(p => {
      if (p.money < 0) {
        p.money = 0;
        count++;
      }
    });
    renderBoard();

    const alertMsg = `📜 【徳政令カード】発動！\n借金を抱えていた ${count} 名のプレイヤーの借金が帳消しになりました！`;
    if (myPlayerId === 'p1') sendData('SHOW_ALERT', { text: alertMsg });
    alert(alertMsg);
    syncGameState();
  } else if (usedCard.id === "oharai") {
    if (bonbyOwner === targetPlayer.id) {
      bonbyOwner = null;
      renderBoard();
      const alertMsg = `⛩️ 【おはらいカード】発動！\n${targetPlayer.name} に取り憑いていた貧乏神は消え去りました！`;
      if (myPlayerId === 'p1') sendData('SHOW_ALERT', { text: alertMsg });
      alert(alertMsg);
    } else {
      alert("貧乏神が取り憑いていなかったため、何も起こりませんでした…（カードは消費されました）");
    }
    syncGameState();
  } else {
    renderBoard();
    await rollDiceInternal(usedCard.diceCount);
  }
}

function getRandomByWeight(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let randomNum = Math.floor(Math.random() * totalWeight);

  for (const item of items) {
    if (randomNum < item.weight) return item;
    randomNum -= item.weight;
  }
  return items[0];
}

function drawRandomCard() {
  const cards = Object.values(CARD_TYPES);
  return getRandomByWeight(cards);
}

function getInflationMultiplier() {
  return 1 + (currentYear - 1) * 0.5;
}

// --- 貧乏神（ボンビー）制御 ---
function checkBonbyTile(tile) {
  const curPlayer = getCurrentPlayer();
  if (tile && tile.type === "bonby" && bonbyOwner !== curPlayer.id) {
    bonbyOwner = curPlayer.id;
    const msgEl = document.getElementById("message");
    if (msgEl) msgEl.innerText += ` 👹 貧乏神マスを踏んだ！貧乏神が ${curPlayer.name} に憑りついた！`;
  }
}

function checkBonbyPass() {
  if (bonbyOwner === null) return;

  const curPlayer = getCurrentPlayer();
  const otherPlayers = players.filter(p => p.id !== curPlayer.id);

  otherPlayers.forEach(other => {
    if (curPlayer.position === other.position && bonbyOwner === curPlayer.id) {
      bonbyOwner = other.id;
      const msgEl = document.getElementById("message");
      if (msgEl) msgEl.innerText += ` 👹 貧乏神を ${other.name} になすりつけた！`;
    }
  });
}

async function handleBonbyAction() {
  if (bonbyOwner === null) return;

  const victim = players.find(p => p.id === bonbyOwner);
  if (!victim) return;

  const rand = Math.random();

  let ownedProperties = [];
  board.forEach(tile => {
    if (tile.type === "station") {
      tile.properties.forEach(p => {
        if (p.owner === victim.id) ownedProperties.push(p);
      });
    }
  });

  let alertText = "";

  if (rand < 0.4) {
    const loss = (Math.floor(Math.random() * 5) + 2) * 100;
    victim.money -= loss;
    alertText = `👹 貧乏神「ほい〜！ ${victim.name} のおサイフから ${loss}万円 ポイしておいたのねん！」`;
  } else if (rand < 0.7 && victim.cards.length > 0) {
    const lostCardIndex = Math.floor(Math.random() * victim.cards.length);
    const lostCard = victim.cards.splice(lostCardIndex, 1)[0];
    alertText = `👹 貧乏神「【${lostCard.name}】なんて要らないのねん！ ビリビリ〜！」`;
  } else if (ownedProperties.length > 0) {
    const lostProp = ownedProperties[Math.floor(Math.random() * ownedProperties.length)];
    lostProp.owner = null;
    alertText = `👹 貧乏神「${victim.name} が持ってる【${lostProp.name}】を勝手に売ってきたのねん！」`;
  } else {
    const loss = 300;
    victim.money -= loss;
    alertText = `👹 貧乏神「ヒマだから ${victim.name} から ${loss}万円 もらっておくのねん！」`;
  }

  if (myPlayerId === 'p1') {
    sendData('SHOW_ALERT', { text: alertText });
  }
  alert(alertText);

  renderBoard();
  syncGameState();
}

async function autoTriggerBonbyCard() {
  const curPlayer = getCurrentPlayer();

  bonbyOwner = curPlayer.id;
  renderBoard();

  alert(`👹 呪いの効果！【ボンビーカード】が強制発動！\n${curPlayer.name} に貧乏神が取り憑きました！`);
  const msgEl = document.getElementById("message");
  if (msgEl) msgEl.innerText = `👹 ${curPlayer.name} に貧乏神が取り憑きました！`;

  if (curPlayer.id === myPlayerId && !curPlayer.isCpu) {
    document.getElementById("next-btn").style.display = "inline-block";
  } else if (myPlayerId === 'p1' && curPlayer.isCpu) {
    await new Promise(resolve => setTimeout(resolve, 800));
    nextTurn();
  }
}

// --- ターン進行・イベント・決算 ---
function nextTurn() {
  if (isGameOver) return;
  if (myPlayerId === 'p1' || getCurrentPlayer().id === myPlayerId) {
    sendData('NEXT_TURN');
    nextTurnLocal();
  }
}

function nextTurnLocal() {
  canBuyProperties = false;
  isCpuProcessing = false;

  document.getElementById("next-btn").style.display = "none";
  document.getElementById("dice-btn").style.display = "inline-block";
  document.getElementById("card-btn").style.display = "inline-block";

  switchTurn();
}

function switchTurn() {
  if (isGameOver) return;
  isCpuProcessing = false;
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;

  if (currentPlayerIndex === 0) {
    advanceCalendar();
  } else {
    renderBoard();
  }

  updateControlsState();

  const curPlayer = getCurrentPlayer();
  const currentTile = board.find(t => t.id === curPlayer.position);
  if (currentTile) showTileInfo(currentTile);

  syncGameState();
  checkCpuTurnTrigger();
}

function checkDestinationGoal(tile) {
  const curPlayer = getCurrentPlayer();
  if (tile && tile.id === destinationId) {
    const prizeMoney = Math.max(100, Math.round((5000 * getInflationMultiplier()) / 100) * 100);
    
    curPlayer.money += prizeMoney;
    
    let bonbyMsg = "";
    if (bonbyOwner === curPlayer.id) {
      bonbyOwner = null;
      bonbyMsg = "\n👹 貧乏神は姿を消しました！";
    }

    const goalMsg = `🎊 祝！ ${curPlayer.name} が ${tile.name} に一番乗りで到着しました！\n💰 到着賞金として 【${prizeMoney}万円】 を獲得${bonbyMsg}`;
    
    if (myPlayerId === 'p1') {
      sendData('SHOW_ALERT', { text: goalMsg });
      setNextDestination();
    }
    alert(goalMsg);

    renderBoard();
  }
}

function triggerRandomEvent(player) {
  const events = [
    { 
      name: "宝くじ当選！", 
      effect: () => { 
        const prize = Math.round(1000 * getInflationMultiplier());
        player.money += prize; 
        alert(`🎉 ${player.name} は宝くじで1000万円当たった！`); 
      } 
    },
    { 
      name: "スリ被害…", 
      effect: () => { 
        const baseLossTable = [
          { amount: 300, weight: 50 },
          { amount: 500, weight: 34 },
          { amount: 1000, weight: 13 },
          { amount: 100000, weight: 3  }
        ];
        const baseAmount = getRandomByWeight(baseLossTable).amount;
        const loss = Math.max(100, Math.round((baseAmount * getInflationMultiplier()) / 100) * 100);
        
        player.money = Math.max(100, player.money - loss); 
        alert(`💸 ${player.name} は${loss}万円スられた！`); 
      } 
    },
    { 
      name: "カード拾得！", 
      effect: () => {
        const randomCard = drawRandomCard();
        if (randomCard.id === "bonby") {
          bonbyOwner = player.id;
          alert(`👹 ナンデスト！ 拾ったカードから貧乏神が飛び出してきた！\n${player.name} に貧乏神が取り憑いた！`);
          renderBoard();
        } else {
          if (player.cards.length < 3) {
            player.cards.push(randomCard);
            alert(`🎴 ${player.name} は【${randomCard.name}】を拾った！`);
          } else {
            alert(`🎴 ${player.name} は【${randomCard.name}】を拾ったが、手札がいっぱいで諦めた…`);
          }
        }
      } 
    }
  ];

  const selected = events[Math.floor(Math.random() * events.length)];
  selected.effect();
}

function handleTileEffect(tile) {
  if (!tile) return;
  const msg = document.getElementById("message");
  const curPlayer = getCurrentPlayer();

  if (tile.type === "blue") {
    curPlayer.money += 500;
    if (msg) msg.innerText += " 👉 青マス！500万円 GET！";
  } else if (tile.type === "red") {
    const baseRedLossTable = [
      { amount: 100, weight: 45 },
      { amount: 200, weight: 35 },
      { amount: 400, weight: 15 },
      { amount: 800, weight: 5  }
    ];

    const baseAmount = getRandomByWeight(baseRedLossTable).amount;
    const redLoss = Math.max(100, Math.round((baseAmount * getInflationMultiplier()) / 100) * 100);
    curPlayer.money -= redLoss;
    if (msg) msg.innerText += ` 👉 赤マス！${redLoss}万円 損した…`;
  } else if (tile.type === "yellow") {
    const newCard = drawRandomCard();
    if (newCard.id === "bonby") {
      if (msg) msg.innerText += " ⚠️ 呪いの【ボンビーカード】を引き当てた！";
      setTimeout(() => {
        autoTriggerBonbyCard();
      }, 800);
      return;
    }
    if (curPlayer.cards.length >= 3) {
      if (msg) msg.innerText += " 👉 黄色マス！(カードが満タンで手に入りませんでした)";
    } else {
      curPlayer.cards.push(newCard);
      if (msg) msg.innerText += ` 👉 黄色マス！【${newCard.name}】を手に入れた！`;
    }
  } else if (tile.type === "event") {
    triggerRandomEvent(curPlayer);
  } else if (tile.type === "station") {
    if (msg) msg.innerText += ` 👉 ${tile.name}に到着！`;
  } else if (tile.type === "normal") {
    if (msg) msg.innerText += ` 👉 ノーマルマスに止まりました。`;
  }
  
  renderBoard();
}

function advanceCalendar() {
  currentMonth++;
  if (currentMonth > 12) {
    currentMonth = 1;
  }
  if (currentMonth === 4){
    currentYear++;
  }

  const dateDisp = document.getElementById("date-display");
  if (dateDisp) dateDisp.innerText = `${currentYear}年目 ${currentMonth}月`;

  if ((gameMode === "3years" && currentYear > 3 && currentMonth > 3) || (gameMode === "5years" && currentYear > 5 && currentMonth > 3)) {
    finishGame();
    return;
  }

  if ([3, 10].includes(currentMonth)) {
    execQuarterlyKessan();
  } else if (currentMonth === 4) {
    execKessan();
  } else {
    renderBoard();
  }
}

function finishGame() {
  isGameOver = true;
  const sorted = [...players].sort((a, b) => b.money - a.money);
  
  let html = "👑 【最終結果発表】 👑\n\n";
  sorted.forEach((p, idx) => {
    html += `${idx + 1}位: ${p.name} (${p.money}万円)\n`;
  });

  alert(`🎉 プレイ期間が終了しました！\n\n${html}`);
  showKessanModal("🏆 最終結果発表 🏆", "全プレイ期間が終了しました！", sorted.map(s => ({ id: s.id, name: s.name, color: s.color, count: 0, income: s.money })));
  
  const closeBtn = document.getElementById("kessan-close-btn");
  if (closeBtn) closeBtn.innerText = "ゲーム終了";
  updateControlsState();
  syncGameState();
}

function execQuarterlyKessan() {
  if (myPlayerId === 'p1') sendData('SHOW_KESSAN', { isQuarterly: true });
  execQuarterlyKessanLocal();
}

function execQuarterlyKessanLocal() {
  const results = players.map(p => ({ id: p.id, name: p.name, color: p.color, count: 0, income: 0 }));

  board.forEach(tile => {
    if (tile.type === "station") {
      tile.properties.forEach(prop => {
        if (prop.owner !== null) {
          const res = results.find(r => r.id === prop.owner);
          if (res) {
            res.count++;
            res.income += Math.floor((prop.price * (prop.rate / 100)) * 0.50);
          }
        }
      });
    }
  });

  if (myPlayerId === 'p1') {
    results.forEach(res => {
      const p = players.find(player => player.id === res.id);
      if (p) p.money += res.income;
    });
  }

  renderBoard();
  showKessanModal("📈 中間決算発表 📈", `${currentYear}年目 ${currentMonth}月期（収益の50%を分配）`, results);
}

function execKessan() {
  if (myPlayerId === 'p1') sendData('SHOW_KESSAN', { isQuarterly: false });
  execKessanLocal();
}

function execKessanLocal() {
  const results = players.map(p => ({ id: p.id, name: p.name, color: p.color, count: 0, income: 0 }));

  board.forEach(tile => {
    if (tile.type === "station") {
      tile.properties.forEach(prop => {
        if (prop.owner !== null) {
          const res = results.find(r => r.id === prop.owner);
          if (res) {
            res.count++;
            res.income += Math.floor(prop.price * (prop.rate / 100));
          }
        }
      });
    }
  });

  if (myPlayerId === 'p1') {
    results.forEach(res => {
      const p = players.find(player => player.id === res.id);
      if (p) p.money += res.income;
    });
  }

  renderBoard();
  showKessanModal("🎊 本決算発表 🎊", `${currentYear - 1}年目の年度本決算です！`, results);
}

function showKessanModal(title, subtext, results) {
  const titleEl = document.getElementById("kessan-title");
  const yearTextEl = document.getElementById("kessan-year-text");
  if (titleEl) titleEl.innerText = title;
  if (yearTextEl) yearTextEl.innerText = subtext;

  const table = document.getElementById("kessan-table");
  if (table) {
    let html = `
      <tr>
        <th>項目</th>
        ${results.map(r => `<th style="color:${r.color}">${r.name}</th>`).join('')}
      </tr>
      <tr>
        <td>${isGameOver ? '総資産/所持金' : '所有物件数'}</td>
        ${results.map(r => `<td>${isGameOver ? r.income + ' 万円' : r.count + ' 件'}</td>`).join('')}
      </tr>
      ${isGameOver ? '' : `
      <tr>
        <td>分配金/収益</td>
        ${results.map(r => `<td>${r.income} 万円</td>`).join('')}
      </tr>
      `}
    `;
    table.innerHTML = html;
  }

  const modal = document.getElementById("kessan-modal");
  if (modal) modal.style.display = "flex";
}

function closeKessan() {
  if (isGameOver) {
    const modal = document.getElementById("kessan-modal");
    if (modal) modal.style.display = "none";
    return;
  }
  sendData('CLOSE_KESSAN');
  closeKessanLocal();
}

function closeKessanLocal() {
  const modal = document.getElementById("kessan-modal");
  if (modal) modal.style.display = "none";
  renderBoard();
  syncGameState();
}

// --- 分岐選択モーダルのドラッグ＆最小化イベント ---
const branchModalContent = document.getElementById("branch-modal-content");
const branchHeader = document.getElementById("branch-header");
let isDraggingBranch = false;
let branchOffsetX = 0, branchOffsetY = 0;

if (branchHeader && branchModalContent) {
  branchHeader.addEventListener("mousedown", (e) => {
    if (e.target.id === "branch-minimize-btn") return;

    isDraggingBranch = true;
    branchOffsetX = e.clientX - branchModalContent.offsetLeft;
    branchOffsetY = e.clientY - branchModalContent.offsetTop;
    
    branchModalContent.style.transform = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDraggingBranch) return;
    branchModalContent.style.left = `${e.clientX - branchOffsetX}px`;
    branchModalContent.style.top = `${e.clientY - branchOffsetY}px`;
  });

  document.addEventListener("mouseup", () => {
    isDraggingBranch = false;
  });
}

function toggleMinimizeBranch(e) {
  e.stopPropagation();
  const btn = document.getElementById("branch-minimize-btn");
  
  if (branchModalContent) {
    branchModalContent.classList.toggle("minimized");
    if (btn) {
      if (branchModalContent.classList.contains("minimized")) {
        btn.innerText = "＋";
      } else {
        btn.innerText = "ー";
      }
    }
  }
}

// --- ページロード・サイズ変更初期化 ---
window.onload = () => {
  updatePlayerConfigs();
  players = [
    { ...ALL_PLAYER_TEMPLATES[0], isCpu: false, money: 5000, position: 0, cards: [] },
    { ...ALL_PLAYER_TEMPLATES[1], isCpu: true, money: 5000, position: 0, cards: [] },
    { ...ALL_PLAYER_TEMPLATES[2], isCpu: true, money: 5000, position: 0, cards: [] }
  ];
  renderBoard();
};

window.onresize = () => {
  updateCameraPosition();
};
