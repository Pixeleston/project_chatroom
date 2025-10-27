<script setup>
import { ref, onUnmounted } from 'vue'
import { VueFlow, Panel, useVueFlow } from '@vue-flow/core'
import custom_node_condition from './components/custom_node_condition_edit.vue'
import custom_node_direct from './components/custom_node_direct_edit.vue'
import custom_node_start from './components/custom_node_start_edit.vue'

import { useFlowStore } from '@/stores/flowStore'

const nodes = ref([])
const edges = ref([])
const selectedNodes = ref([])
const { toObject } = useVueFlow()

const flow = useFlowStore()

onUnmounted(() => {
  flow.selectedNode = null
})

const nodeTypes = {
  condition: custom_node_condition,
  direct: custom_node_direct,
  start: custom_node_start,
}

function addNode(type) {
  console.log("addNode : " + flow.nodes);
  const id = `node-${Date.now()}`
  const base = {
    id,
    type,
    position: { x: 100 + flow.nodes.length * 40, y: 100 },
    data: { label: `${type} 節點`, label_then: 'no action', label_detail: null },
  }
  if (type === 'condition') base.data.label_if = 'no condition'
  flow.nodes.push(base)
}

function addStartNode() {
  const exists = flow.nodes.some(n => n.id === 'start')
  if (exists) return              // 已有 start，直接忽略

  flow.nodes.push({
    id: 'start',
    type: 'start',               // 或 'condition'，視需求
    position: { x: 50, y: 50 },   // 想放哪就改哪
    data: { label: 'Root 節點', label_then: 'begin' },
  })
}

function deleteSelected() {
  const idsToDelete = selectedNodes.value.map(n => n.id)
  flow.nodes = flow.nodes.filter(n => !idsToDelete.includes(n.id))
  flow.edges = flow.edges.filter(e => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target))
  selectedNodes.value = []
}

function onNodeClick({ node }) {
  selectedNodes.value = [node]
  flow.setSelectedNode(JSON.parse(JSON.stringify(node)))
  console.log(flow.selectedNode.data)
}

function onConnect(params) {
  flow.edges.push({
    ...params,
    id: `e${flow.edges.length + 1}`,
    type: 'default',
  })
}

// ========== 匯出 JSON ==========
function exportToJson() {
  const flowData = toObject()
  flowData.currentNode = 'start'
  flowData.currentNodeSmall = 'null'
  flowData.voting = false
  flowData.voting_array = []
  flowData.hoping = flow.hoping
  flowData.memory = {
    currentMemory: "",
    nodesMemory: []
  }
  flowData.outline = flow.outline
  const jsonString = JSON.stringify(flowData, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'flowchart.json'
  a.click()
  URL.revokeObjectURL(url)
}

// ========== 手動讀取 ==========
async function loadFromServer() {
  flow.loadFromServer()
  /*
  try {
    const res = await fetch('http://localhost:3000/api/state')
    const json = await res.json()
    flow.nodes.value = json.nodes ?? []
    flow.edges.value = json.edges ?? []
    flow.outline = json.outline ?? ""
  } catch (err) {
    alert('❌ 無法讀取資料：' + err.message)
  }
  */
}

// ========== 手動儲存 ==========
async function saveToServer() {
  const data = {
    nodes: flow.nodes,
    edges: flow.edges,
    outline: flow.outline,
  }
  try {
    await fetch('http://localhost:3000/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    alert('✅ 已儲存到伺服器')
  } catch (err) {
    alert('❌ 儲存失敗：' + err.message)
  }
}

function onFileSelected(event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result)
      if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
        flow.nodes = data.nodes
        flow.edges = data.edges
        flow.outline = data.outline ?? ""
        console.log('✅ 匯入成功')
      } else {
        alert('❌ 檔案格式錯誤：需要包含 nodes 和 edges 陣列')
      }
    } catch (err) {
      alert('❌ JSON 解析錯誤：' + err.message)
    }
  }
  reader.readAsText(file)
}

loadFromServer()

</script>

<template>
  <div style="display: flex; height: 100%" class="wrapper-flow">

    <div class="flow-toolbar">
      <button @click="addStartNode">⭐新增Start</button>
      <button @click="addNode('direct')">➕ 新增節點</button>
      <button @click="deleteSelected">🗑️ 刪除節點</button>
      <button @click="saveToServer">💾儲存到伺服器</button>
      <button @click="exportToJson">📄 匯出JSON</button>
      <label class="import-btn">
        📂匯入JSON
        <input
          type="file"
          accept=".json"
          @change="onFileSelected"
          style="display: none;"
        />
      </label>
      <button @click="exportToJson">1️⃣</button>
      <button @click="exportToJson">2️⃣</button>
      <button @click="exportToJson">3️⃣</button>
      <button @click="exportToJson">4️⃣</button>
      <button @click="exportToJson">5️⃣</button>
      <button @click="exportToJson">6️⃣</button>
      <button @click="exportToJson">7️⃣</button>
      <button @click="exportToJson">8️⃣</button>
      <button @click="exportToJson">9️⃣</button>
      
    </div>
    
    <VueFlow
      v-if="!showPreview"
      v-model:nodes="flow.nodes"
      v-model:edges="flow.edges"
      @node-click="onNodeClick"
      @connect="onConnect"
      :node-types="nodeTypes"
      :elements-selectable="true"
      :nodes-draggable="true"
      :nodes-connectable="true"
      connection-mode="loose"
      fit-view
      style="flex: 1"
      class="local-flow"
    >
    </VueFlow>
  </div>
</template>

<style>

.local-flow{
    background: #e6fcff
}

.flow-toolbar {
  row-gap: 20px;
  flex-wrap: wrap;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.7); /* 淺白半透明條 */
  border-bottom: 1px solid #bde0eb;
  backdrop-filter: blur(6px);
}


.wrapper-flow {
  display: flex;
  flex-direction: column; /* 工具列在上，流程圖在下 */
  height: 100vh;
  background: #929292ff;    /* 藍色背景 */
  overflow: hidden;
  border: 2px solid #d0f0f7;
  border-radius: 10px;
  padding: 20px 20px 20px 20px;
}

.flow-toolbar button,
.flow-toolbar .import-btn {
  background-color: #ffffff;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.flow-toolbar .import-btn {
  display: inline-block;
  color: #333;
}

</style>