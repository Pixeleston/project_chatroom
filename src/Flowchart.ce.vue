<script setup>
import { defineCustomElement, ref } from 'vue'
import { VueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const nodes = ref([...])
const edges = ref([...])
</script>

<template>
  <VueFlow v-model:nodes="nodes" v-model:edges="edges" style="width:100%;height:100%"/>
</template>

<script>
export default defineCustomElement()
</script>