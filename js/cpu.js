/**
 * js/cpu.js
 * CPU（AI）の意思決定および思考・自動実行ロジック
 */

// --- 目的地までの最短距離（マス数）を計算 ---
function getDistanceToDestination(startTileId, targetTileId) {
  if (startTileId === targetTileId) return 0;

  const queue = [{ id: startTileId, dist: 0 }];
  const visited = new Set([startTileId]);

  while (queue.length > 0) {
    const { id, dist } = queue.shift();
    const currentTile = board.find(t => t.id === id);

    if (!currentTile) continue;

    for (const nextId of currentTile.next) {
      if (nextId === targetTileId) return dist + 1;
      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push({ id: nextId, dist: dist + 1 });
      }
    }
  }
  return 999;
}

// --- CPUターンの自動実行ロジック ---
async function checkCpuTurnTrigger() {
  if (myPlayerId !== 'p1' || isGameOver) return;

  const curPlayer = getCurrentPlayer();
  if (!curPlayer || !curPlayer.isCpu || isCpuProcessing) return;

  isCpuProcessing = true;

  try {
    await new Promise(resolve => setTimeout(resolve, 800));

    // 所持カードから有用なカードを検索
    const tokuseiIdx = curPlayer.cards.findIndex(c => c.id === "tokusei");
    const takeoverIdx = curPlayer.cards.findIndex(c => c.id === "takeover");
    const moveCardIdx = curPlayer.cards.findIndex(c => ["express", "shinkansen", "linear", "fly"].includes(c.id));
    const oharaiIdx = curPlayer.cards.findIndex(c => c.id === "oharai");

    // 状況に応じたカード使用またはサイコロ実行
    if (bonbyOwner === curPlayer.id && oharaiIdx !== -1) {
      await useCardLocal(curPlayer.id, oharaiIdx);
    } else if (curPlayer.money < 0 && tokuseiIdx !== -1) {
      await useCardLocal(curPlayer.id, tokuseiIdx);
    } else if (takeoverIdx !== -1 && Math.random() < 0.7) {
      await useCardLocal(curPlayer.id, takeoverIdx);
    } else if (moveCardIdx !== -1 && Math.random() < 0.5) {
      await useCardLocal(curPlayer.id, moveCardIdx);
    } else {
      await rollDiceInternal();
    }

    // 移動後の自動物件買い判定
    await new Promise(resolve => setTimeout(resolve, 500));
    const curTile = board.find(t => t.id === curPlayer.position);
    if (curTile && curTile.type === "station") {
      curTile.properties.forEach(prop => {
        if (prop.owner === null && curPlayer.money >= prop.price) {
          buyPropertyLocal(curTile.id, prop.id, curPlayer.id);
        }
      });
    }

    // ターン終了へ移行
    await new Promise(resolve => setTimeout(resolve, 800));
    nextTurn();
  } catch (err) {
    console.error("CPUターン中にエラーが発生しました:", err);
  } finally {
    isCpuProcessing = false;
  }
}
