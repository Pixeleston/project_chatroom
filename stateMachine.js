// stateMachine.js

/**
 * @param {string} currentNodeId 當前節點 id
 * @param {Array} nodes 所有節點資料
 * @param {Array} edges 所有邊資料
 * @param {object} context 包含最新的對話、事件、LLM 判斷結果等
 * @returns {string} 下一個節點 id（如果有轉移）
 */
export function getNextNode(currentNodeId, nodes, edges, context) {
  const outgoingEdges = edges.filter(e => e.source === currentNodeId)

  for (const edge of outgoingEdges) {
    const targetNode = nodes.find(n => n.id === edge.target)
    if (!targetNode) continue

    // 這裡加入轉移邏輯判斷，可以根據 context、label_if 等
    // if (targetNode.data?.label_if === '使用者說了開始') {
    //   if (context.latestUserMessage?.includes('開始')) {
    //     return targetNode.id
    //   }
    // }

    // 更多自定邏輯 ...
  }

  return currentNodeId // 沒有轉移就維持原地
}