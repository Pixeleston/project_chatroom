<script setup>
import { ref } from 'vue'
import { VueFlow, Panel, useVueFlow } from '@vue-flow/core'
import custom_node_condition from './components/custom_node_condition_edit.vue'
import custom_node_direct from './components/custom_node_direct_edit.vue'
import custom_node_start from './components/custom_node_start_edit.vue'

const nodes = ref([])
const edges = ref([])
const selectedNodes = ref([])
const { toObject } = useVueFlow()

const nodeTypes = {
  condition: custom_node_condition,
  direct: custom_node_direct,
  start: custom_node_start,
}

function addNode(type) {
  const id = `node-${Date.now()}`
  const base = {
    id,
    type,
    position: { x: 100 + nodes.value.length * 40, y: 100 },
    data: { label: `${type} 節點`, label_then: 'no action' },
  }
  if (type === 'condition') base.data.label_if = 'no condition'
  nodes.value.push(base)
}

function addStartNode() {
  const exists = nodes.value.some(n => n.id === 'start')
  if (exists) return              // 已有 start，直接忽略

  nodes.value.push({
    id: 'start',
    type: 'start',               // 或 'condition'，視需求
    position: { x: 50, y: 50 },   // 想放哪就改哪
    data: { label: 'Start 節點', label_then: 'begin' },
  })
}

function deleteSelected() {
  const idsToDelete = selectedNodes.value.map(n => n.id)
  nodes.value = nodes.value.filter(n => !idsToDelete.includes(n.id))
  edges.value = edges.value.filter(e => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target))
  selectedNodes.value = []
}

function onNodeClick({ node }) {
  selectedNodes.value = [node]
}

function onConnect(params) {
  edges.value.push({
    ...params,
    id: `e${edges.value.length + 1}`,
    type: 'default',
  })
}

// ========== 匯出 JSON ==========
function exportToJson() {
  const flowData = toObject()
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
  try {
    const res = await fetch('http://localhost:3000/api/state')
    const json = await res.json()
    nodes.value = json.nodes ?? []
    edges.value = json.edges ?? []
  } catch (err) {
    alert('❌ 無法讀取資料：' + err.message)
  }
}

// ========== 手動儲存 ==========
async function saveToServer() {
  const data = {
    nodes: nodes.value,
    edges: edges.value,
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
        nodes.value = data.nodes
        edges.value = data.edges
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

</script>

<template>
  <div style="display: flex; height: 100%">
    <div style="width: 200px; background: #eee; padding: 10px;">
      <button @click="addStartNode">⭐ 新增 Start</button>
      <button @click="addNode('condition')">➕ Condition</button>
      <button @click="addNode('direct')">➕ Direct</button>
      <button @click="deleteSelected">🗑️ 刪除選取節點</button>
      <hr />
      <button @click="loadFromServer">🔄 載入伺服器資料</button>
      <button @click="saveToServer">💾 儲存到伺服器</button>
    </div>

    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      @node-click="onNodeClick"
      @connect="onConnect"
      :node-types="nodeTypes"
      :elements-selectable="true"
      :nodes-draggable="true"
      :nodes-connectable="true"
      connection-mode="loose"
      fit-view
      style="flex: 1"
    >
      <Panel position="top-right">
        <button @click="exportToJson">📄 匯出 JSON</button>
        <label style="cursor: pointer;">
          匯入 JSON
          <input type="file" accept=".json" @change="onFileSelected" style="display: none" />
        </label>
      </Panel>
    </VueFlow>
  </div>
</template>