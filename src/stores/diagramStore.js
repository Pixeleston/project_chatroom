import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ADDRESS_CONFIG } from '../config.js'

export const useDiagramStore  = defineStore('diagram', () => {
  const nodes = ref([])
  const edges = ref([])
  const memory = ref({ currentMemory: "", nodesMemory: [] })
  const currentNodeSmall = ref(null)
  const currentNode = ref('start')
  const voting_array = ref([])
  const voting = ref(true)
  const hoping = ref('')
  const outline = ref('')

  async function loadFromServer() {
  try {
    const json = await fetch(ADDRESS_CONFIG.ADDRESS_3000 + '/api/diagram').then(r => r.json())

    nodes.value = json.nodes || []
    edges.value = json.edges || []
    currentNode.value = json.currentNode || 'start'

    voting_array.value = json.voting_array || 'start'
    voting.value = true
    hoping.value = json.hoping || ''
    outline.value = json.outline || ''

    memory.value = json.memory || { currentMemory: "", nodesMemory: [] }
    currentNodeSmall.value = json.currentNodeSmall || null
    voting_array.value = json.voting_array || []

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
      const res = await fetch(ADDRESS_CONFIG.ADDRESS_3000 + '/api/diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        nodes: nodes.value,
        edges: edges.value,
        currentNode: currentNode.value,
        voting_array: voting_array.value,
        voting: true,
        hoping: hoping.value,
        outline: outline.value,
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
  voting_array,
  voting,
  hoping,
  outline,
  currentNodeSmall,
  memory,
  loadFromServer,
  saveToServer,
}
})