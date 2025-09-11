import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'

export const useReportStore  = defineStore('report', () => {
  const report_text = ref('start')
  const state_diagram = ref([])
  const nodes = ref([])
  const edges = ref([])
  const memory = ref({ currentMemory: "", nodesMemory: [] })
  const currentNodeSmall = ref(null)
  const currentNode = ref('start')
  const selectedNode = ref('start')
  const detail = ref('detail')

  async function loadFromServer() {
  try {
    const json = await fetch('http://localhost:3000/api/getReport').then(r => r.json())
    
    state_diagram.value = json.state_diagram || {}
    nodes.value = json.state_diagram.nodes || []
    edges.value = json.state_diagram.edges || []
    currentNode.value = json.state_diagram.currentNode || 'start'
    selectedNode.value = 'start'
    report_text.value = json.report_text

    memory.value = json.state_diagram.memory || { currentMemory: "", nodesMemory: [] }
    currentNodeSmall.value = json.state_diagram.currentNodeSmall || null

    // 若沒有 currentNode，設定並回寫
    if (!json.state_diagram.currentNode || !json.state_diagram.memory) {
      await saveToServer()
    }

  } catch (e) {
    console.error('❌ 無法讀取 /api/diagram', e)
  }
}

function updateNodes(){
  nodes.value = state_diagram.value.nodes || []
}

  async function saveToServer() {
  try {
    const reportData = {
      report_text: report_text.value,
      state_diagram: toRaw(state_diagram.value)  // ⭐️ 解掉 Proxy
    }

    const res = await fetch('http://localhost:3000/api/setReport', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData, null, 2)
    })

    if (!res.ok) throw new Error(await res.text())
    updateNodes()
    console.log('✅ 已儲存到伺服器')
  } catch (err) {
    console.error('❌ 儲存失敗', err)
  }
}

  return {
  state_diagram,
  nodes,
  edges,
  currentNode,
  selectedNode,
  report_text,
  detail,
  currentNodeSmall,
  memory,
  loadFromServer,
  saveToServer,
  updateNodes
}
})