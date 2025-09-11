<script setup>
import { computed, onMounted } from 'vue'
import { VueFlow, Panel } from '@vue-flow/core'
import custom_node_condition from './components/custom_node_condition.vue'
import custom_node_direct   from './components/custom_node_direct.vue'
import custom_node_start    from './components/custom_node_start.vue'
import custom_node_child from './components/custom_node_child.vue'
import { useReportStore }  from '@/stores/reportStore.js'

const report = useReportStore()


const nodeTypes = {
  condition: custom_node_condition,
  direct:    custom_node_direct,
  start:     custom_node_start,
  child:     custom_node_child,
}

// 讀伺服器
onMounted(async () => {
  await report.loadFromServer()
  console.log('📥 Loaded Diagram:', JSON.stringify(report.memory, null, 2))
})

/* 把目前節點加上 style */
const nodesWithHighlight = computed(() =>
  report.nodes.map(n => {
    // 先複製並清掉過去可能殘留的 boxShadow/border
    const style = { ...(n.style || {}) }
    delete style.boxShadow
    delete style.border

    // 再針對 currentNode 加上
    if (n.id === report.currentNode) {
      style.boxShadow = '0 0 12px 4px rgba(0,174,255,0.7)'
      style.border    = '2px solid #00aeff'
    }

    return { ...n, style }
  })
)

const smallFlowNodesWithHighlight = computed(() =>
  smallFlowNodes.value.map(n => {
    const style = { ...(n.style || {}) }
    delete style.boxShadow
    delete style.border

    if (n.id === report.currentNodeSmall) {
      style.boxShadow = '0 0 12px 4px rgba(255,0,174,0.7)'
      style.border    = '2px solid #ff00ae'
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
        report.nodes = data.nodes
        report.edges = data.edges
        report.currentNode = data.currentNode
        report.memory = data.memory;
        report.currentNodeSmall = data.currentNodeSmall;
        console.log('✅ 匯入成功')
        await report.saveToServer()
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


// ========== 子圖 ========== //
console.log(report)
const currentMemoryNode = computed(() => {
  if (!report.memory || !Array.isArray(report.memory.nodesMemory)) return null
  return report.memory.nodesMemory.find(n => n.id === report.currentNode)
})

const smallFlowNodes = computed(() => {
  if (!currentMemoryNode.value) return []

  return currentMemoryNode.value.smallNodes.map((sn, index) => ({
    id: sn.id,
    type: 'child',
    position: { x: 350 * index, y: 50 },  // 水平排開
    data: { label: sn.theme, target: sn.target, summary: sn.summary }
  }))
})

//console.log(currentMemoryNode)
//console.log(smallFlowNodes)

const smallFlowEdges = computed(() => {
  if (smallFlowNodes.value.length < 2) return []
  return smallFlowNodes.value.slice(0, -1).map((node, i) => ({
    id: `e-${i}`,
    source: node.id,
    target: smallFlowNodes.value[i + 1].id,
    type: 'default'
  }))
})

function onNodeClick({ node }) {
  report.currentNode = node.id
  report.detail = node.data.label_detail
}

// ========== 子圖 ========== //

</script>

<template>
  <div class="flow-wrapper">
    <!-- 主狀態圖 (70%) -->
    <div class="flow-top">
      <VueFlow
        :nodes="nodesWithHighlight"
        :edges="report.edges"
        :node-types="nodeTypes"
        @node-click="onNodeClick"
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
    </div>

    <!-- 次狀態圖 (30%) -->
    <div class="flow-bottom">
      <VueFlow
        :nodes="smallFlowNodes"
        :edges="smallFlowEdges"
        :node-types="nodeTypes"
        fit-view
      />
    </div>
  </div>
</template>