import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDiagramStore  = defineStore('diagramSimulator', () => {
  const nodes = ref([])
  const edges = ref([])
  const memory = ref({ currentMemory: "", nodesMemory: [] })
  const currentNodeSmall = ref(null)
  const currentNode = ref('start')
  const voting = ref(false)
  const voting_array = ref([])
  const hoping = ref("")

  async function loadFromServer() {
  try {
    console.log('================== json start await ==================')
    const json = await fetch('http://localhost:3000/api/diagramSimulator').then(r => r.json())
    console.log('================== json ==================')
    nodes.value = json.nodes || []
    edges.value = json.edges || []
    currentNode.value = json.currentNode || 'start'

    memory.value = json.memory || { currentMemory: "", nodesMemory: [] }
    currentNodeSmall.value = json.currentNodeSmall || null
    voting.value = json.voting || false
    voting_array.value = json.voting_array || []
    hoping.value = json.hoping || ""

    if (!json.currentNode || !json.memory) {
      await saveToServer()
    }
    //console.log('讀取 /api/diagramSimulator !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  } catch (e) {
    console.error('❌ 無法讀取 /api/diagramSimulator', e)
  }
}

  async function saveToServer() {
    try {
      const res = await fetch('http://localhost:3000/api/diagramSimulator', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nodes: nodes.value,
    edges: edges.value,
    currentNode: currentNode.value,
    voting: voting.value,
    voting_array: voting_array.value,
    hoping: hoping.value,
    memory: memory.value,
        currentNodeSmall: currentNodeSmall.value,
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
  currentNode,
  currentNodeSmall,
  memory,
  voting,
  voting_array,
  hoping,
  loadFromServer,
  saveToServer,
}
})