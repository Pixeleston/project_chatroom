<template>
  <VueFlow
    :nodes="nodes"
    :edges="edges"
    :node-types="nodeTypes"
    fit-view
  />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { VueFlow } from '@vue-flow/core'
import custom_node_condition from './components/custom_node_condition.vue'
import custom_node_direct from './components/custom_node_direct.vue'
import custom_node_start from './components/custom_node_start.vue'

const nodes = ref([])
const edges = ref([])

const nodeTypes = {
  condition: custom_node_condition,
  direct: custom_node_direct,
  start: custom_node_start,
}

onMounted(async () => {
  try {
    const json = await fetch('/state_diagram.json').then(r => r.json())
    nodes.value = json.nodes
    edges.value = json.edges
  } catch (e) {
    console.error('載入 state_diagram.json 失敗', e)
  }
})

function toggleEdgeAnimation(edgeId) {
  edges.value = edges.value.map(edge =>
    edge.id === edgeId ? { ...edge, animated: !edge.animated } : edge
  )
}
defineExpose({ toggleEdgeAnimation })

</script>