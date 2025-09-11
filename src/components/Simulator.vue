<script setup>
import { computed, onMounted } from 'vue'
import { VueFlow, Panel } from '@vue-flow/core'
import custom_node_condition from './components/custom_node_condition.vue'
import custom_node_direct   from './components/custom_node_direct.vue'
import custom_node_start    from './components/custom_node_start.vue'
import { useDiagramStore }  from '@/stores/diagramStore.js'

const diagram = useDiagramStore()

const nodeTypes = {
  condition: custom_node_condition,
  direct:    custom_node_direct,
  start:     custom_node_start,
}

// 讀伺服器
onMounted(async () => {
  await diagram.loadFromServer()
})

/* 把目前節點加上 style */
const nodesWithHighlight = computed(() =>
  diagram.nodes.map(n => {
    // 先複製並清掉過去可能殘留的 boxShadow/border
    const style = { ...(n.style || {}) }
    delete style.boxShadow
    delete style.border

    // 再針對 currentNode 加上
    if (n.id === diagram.currentNode) {
      style.boxShadow = '0 0 12px 4px rgba(0,174,255,0.7)'
      style.border    = '2px solid #00aeff'
    }

    return { ...n, style }
  })
)

/* 匯入並存回伺服器 */
async function onFileSelected (event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result)
      if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
        diagram.nodes = data.nodes
        diagram.edges = data.edges
        console.log('✅ 匯入成功')
        await diagram.saveToServer()
        alert('✅ 已儲存到伺服器')
      } else {
        alert('❌ 格式錯誤，需包含 nodes 和 edges')
      }
    } catch (err) {
      alert('❌ 解析 JSON 錯誤：' + err.message)
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <VueFlow
    :nodes="nodesWithHighlight"
    :edges="diagram.edges"
    :node-types="nodeTypes"
    fit-view
  >
    <Panel position="top-right" class="nodrag nopan">
      <label style="cursor:pointer">
        更改狀態圖
        <input
          type="file"
          accept=".json"
          @change="onFileSelected"
          style="display:none"
        />
      </label>
    </Panel>
  </VueFlow>
</template>