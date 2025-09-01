import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFlowStore  = defineStore('flow', () => {
  const nodes = ref([])
  const edges = ref([])
  const selectedNode = ref(null)

  function setNodes(newNodes) {
    nodes.value = newNodes
  }

  function setEdges(newEdges) {
    edges.value = newEdges
  }

  function setSelectedNode(node) {
    selectedNode.value = node
  }

  function loadFlowDiagram(json) {
    nodes.value = json.nodes ?? []
    edges.value = json.edges ?? []
  }

  function toJSON() {
    return {
      nodes: nodes.value,
      edges: edges.value,
    }
  }

  async function loadFromServer() {
  try {
    const json = await fetch('http://localhost:3000/api/state').then(r => r.json())

    nodes.value = json.nodes || []
    edges.value = json.edges || []

    // 若沒有 currentNode，設定並回寫
    if (!json.currentNode || !json.memory) {
      await saveToServer()
    }

  } catch (e) {
    console.error('❌ 無法讀取 /api/diagram', e)
  }
}

  async function saveToServer() {
    try {
      const res = await fetch('http://localhost:3000/api/state', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nodes: nodes.value,
    edges: edges.value,
  }, null, 2)
})
      if (!res.ok) throw new Error(await res.text())
      console.log('✅ 已儲存到伺服器')
    } catch (err) {
      console.error('❌ 儲存失敗', err)
    }
  }

  return {
  nodes,
  edges,
  selectedNode,
  setNodes,
  setEdges,
  setSelectedNode,
  loadFlowDiagram,
  toJSON,
  loadFromServer,
  saveToServer,
}
})