/**
 * js/dice.js
 * 3Dサイコロ演出・移動アニメーション・分岐選択処理
 */

// --- 3Dサイコロ演出アニメーション ---
async function show3DDiceAnimation(playerName, diceCount, diceResults) {
  const modal = document.getElementById("dice-3d-modal");
  const wrapper = document.getElementById("dice-wrapper");
  const textEl = document.getElementById("dice-3d-text");

  if (!modal || !wrapper || !textEl) return;

  wrapper.innerHTML = "";
  textEl.innerText = `${playerName} がサイコロを振っています…`;
  modal.style.display = "flex";

  const cubeElements = [];
  for (let i = 0; i < diceCount; i++) {
    const container = document.createElement("div");
    container.className = "dice-container";

    const cube = document.createElement("div");
    cube.className = "cube";
    cube.innerHTML = `
      <div class="cube-face face-1">●</div>
      <div class="cube-face face-2">●<br>●</div>
      <div class="cube-face face-3">●&nbsp;&nbsp;<br>&nbsp;●&nbsp;<br>&nbsp;&nbsp;●</div>
      <div class="cube-face face-4">●&nbsp;●<br>●&nbsp;●</div>
      <div class="cube-face face-5">●&nbsp;●<br>&nbsp;●&nbsp;<br>●&nbsp;●</div>
      <div class="cube-face face-6">●&nbsp;●<br>●&nbsp;●<br>●&nbsp;●</div>
    `;
    container.appendChild(cube);
    wrapper.appendChild(container);
    cubeElements.push(cube);
  }

  await new Promise(resolve => setTimeout(resolve, 50));

  cubeElements.forEach((cube, idx) => {
    const result = diceResults[idx];
    const baseRot = CUBE_ROTATIONS[result] || { x: 0, y: 0 };

    const extraRotX = (Math.floor(Math.random() * 3) + 3) * 360;
    const extraRotY = (Math.floor(Math.random() * 3) + 3) * 360;

    const targetX = baseRot.x + extraRotX;
    const targetY = baseRot.y + extraRotY;

    cube.style.transform = `rotateX(${targetX}deg) rotateY(${targetY}deg)`;
  });

  await new Promise(resolve => setTimeout(resolve, 1300));

  const total = diceResults.reduce((a, b) => a + b, 0);
  const resultText = (diceCount > 1) 
    ? `🎲 [ ${diceResults.join(" + ")} ] = ${total} が出ました！` 
    : `🎲 ${total} が出ました！`;

  textEl.innerText = resultText;

  await new Promise(resolve => setTimeout(resolve, 800));
  modal.style.display = "none";
}

// --- サイコロを振る（プレイヤーの操作エントリーポイント） ---
async function rollDice(diceCount = 1) {
  const curPlayer = getCurrentPlayer();
  if (curPlayer.id !== myPlayerId || curPlayer.isCpu || isGameOver) return;
  await rollDiceInternal(diceCount);
}

// --- サイコロ振りの内部実行処理 ---
async function rollDiceInternal(diceCount = 1) {
  const diceBtn = document.getElementById("dice-btn");
  const cardBtn = document.getElementById("card-btn");
  if (diceBtn) diceBtn.disabled = true;
  if (cardBtn) cardBtn.disabled = true;

  try {
    const curPlayer = getCurrentPlayer();

    // 1. 出目を決定
    const diceResults = [];
    for (let d = 0; d < diceCount; d++) {
      diceResults.push(Math.floor(Math.random() * 6) + 1);
    }

    // 2. 他プレイヤーへ送信（通信対戦時）
    sendData('ACTION_ROLL_DICE', { diceCount, diceResults, playerId: curPlayer.id });

    // 3. 3Dサイコロ演出の実行
    await show3DDiceAnimation(curPlayer.name, diceCount, diceResults);

    // 4. コマの移動実行
    await executeDiceRoll(diceCount, diceResults);

  } catch(e) {
    console.error("サイコロ実行エラー:", e);
    const modal = document.getElementById("dice-3d-modal");
    if (modal) modal.style.display = "none";
  }
}

// --- コマの移動ロジック＆アニメーション ---
async function executeDiceRoll(diceCount, diceResults) {
  canBuyProperties = false;
  if (isOverallMapView) toggleMapView();

  const curPlayer = getCurrentPlayer();
  let totalDiceValue = diceResults.reduce((a, b) => a + b, 0);

  const diceText = (diceCount > 1) ? `🎲 [${diceResults.join(" + ")}] = ${totalDiceValue}` : `🎲 ${totalDiceValue}`;
  const msgEl = document.getElementById("message");
  if (msgEl) msgEl.innerText = `${curPlayer.name} は ${diceText} が出ました！`;

  for (let i = 0; i < totalDiceValue; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const currentTile = board.find(t => t.id === curPlayer.position);
    if (!currentTile) break;

    let nextTileId;
    const availableNext = currentTile.next.filter(id => id !== curPlayer.lastPosition);

    if (availableNext.length > 1) {
      if (curPlayer.isCpu && myPlayerId === 'p1') {
        let bestNextId = availableNext[0];
        let minDistance = 999;

        for (const nextId of availableNext) {
          const dist = getDistanceToDestination(nextId, destinationId);
          if (dist < minDistance) {
            minDistance = dist;
            bestNextId = nextId;
          }
        }

        let chooseBestRate = 1.0;
        if (cpuLevel === "easy") chooseBestRate = 0.4;
        if (cpuLevel === "normal") chooseBestRate = 0.75;

        if (Math.random() < chooseBestRate) {
          nextTileId = bestNextId;
        } else {
          nextTileId = availableNext[Math.floor(Math.random() * availableNext.length)];
        }
      } else {
        nextTileId = await promptBranchChoice(availableNext);
      }
    } else if (availableNext.length === 1) {
      nextTileId = availableNext[0];
    } else {
      nextTileId = currentTile.next[0];
    }

    curPlayer.lastPosition = curPlayer.position;
    curPlayer.position = nextTileId;

    checkBonbyPass();
    checkBonbyTile(board.find(t => t.id === curPlayer.position));

    renderBoard();
  }

  const endTile = board.find(t => t.id === curPlayer.position);
  canBuyProperties = true;

  checkDestinationGoal(endTile);
  handleTileEffect(endTile);
  showTileInfo(endTile);

  if (myPlayerId === 'p1' && bonbyOwner === curPlayer.id) {
    if (Math.random() < 0.5) {
      await new Promise(resolve => setTimeout(resolve, 600));
      await handleBonbyAction();
    }
  }

  if (diceBtn) diceBtn.style.display = "none";
  if (cardBtn) cardBtn.style.display = "none";

  const nextBtn = document.getElementById("next-btn");
  if (curPlayer.id === myPlayerId && !curPlayer.isCpu && !isGameOver && nextBtn) {
    nextBtn.style.display = "inline-block";
  }

  syncGameState();
}

// --- 分岐選択モーダルの表示とユーザー入力待ち ---
function promptBranchChoice(nextTileIds) {
  return new Promise(resolve => {
    branchResolve = resolve;

    const curPlayer = getCurrentPlayer();
    const msgEl = document.getElementById("message");

    if (curPlayer.id !== myPlayerId) {
      if (msgEl) msgEl.innerText = `${curPlayer.name} が分岐を選択中...`;
      return;
    }

    const modal = document.getElementById("branch-modal");
    const modalContent = document.getElementById("branch-modal-content");
    const container = document.getElementById("branch-modal-body");
    const minimizeBtn = document.getElementById("branch-minimize-btn");

    if (!modal || !modalContent || !container) return;
    
    modalContent.style.top = "50%";
    modalContent.style.left = "50%";
    modalContent.classList.remove("minimized");
    if (minimizeBtn) minimizeBtn.innerText = "ー";
    
    container.innerHTML = "";

    nextTileIds.forEach(id => {
      const tile = board.find(t => t.id === id);
      if (!tile) return;
      const btn = document.createElement("button");
      btn.className = "branch-btn";
      btn.innerText = `👉 ${tile.name || getTileTypeName(tile.type)} 方面`;
      btn.onclick = () => {
        modal.style.display = "none";
        sendData('BRANCH_CHOSEN', { nextTileId: id });
        resolve(id);
        branchResolve = null;
      };
      container.appendChild(btn);
    });

    modal.style.display = "flex";
  });
}
