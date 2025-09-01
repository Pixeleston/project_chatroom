<template>
  <div class="custom-node-condition">
    <Handle type="target" position="top" :style="{ background: '#555' }" />
    <div class="label-background">
      <textarea v-model="data.label" 
        ref="labelRef" rows="1" 
        class="auto-resize" 
        placeholder="type something..." 
        @input="resize(labelRef)" 
      @mousedown.stop/>
    </div>
    <div class="then-background">
      <div class="input-group">
        <div class="left-group">
          <span class="prefix">Users' target is ...</span>
        </div>
        <textarea v-model="data.label_then" 
          ref="labelThenRef" rows="1" 
          class="auto-resize" 
          placeholder="type something..." 
          @input="resize(labelThenRef)" 
        @mousedown.stop/>
      </div>
    </div>
    <div class="detail-background"
         :style="{
           backgroundColor: (!label_detail || label_detail === 'null')
             ? '#ff9999' // 無細節時用淡紅色
             : '#9fff9f' // 有細節時用淡綠色
         }"
    >
      <span v-if="!data.label_detail">
        no detail yet
      </span>
      <span v-else>
        detail finished
      </span>
    </div>
    <Handle type="source" position="bottom" :style="{ background: '#555' }" />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { Handle } from '@vue-flow/core'

const labelRef = ref(null)
const labelIfRef = ref(null)
const labelThenRef = ref(null)

const props = defineProps({ data: Object, id: String })
const inputText = ref('')
const label = computed(() => props.data?.label ?? `Node ${props.id}`)
const label_if = computed(() => props.data?.label_if ?? `No Condition`)
const label_then = computed(() => props.data?.label_then ?? `No Action`)
const label_detail = computed(() => props.data?.label_detail ?? null)

onMounted(() => {
  resize(labelRef)
  resize(labelThenRef)
})
watch(() => props.data.label, () => {
  resize(labelRef)
})
watch(() => props.data.label_then, () => {
  resize(labelThenRef)
})

function resize(elRef) {
  const el = elRef?.value
  if (el) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
}
</script>

<style scoped>
.custom-node-condition {
  min-width: 300px;
  padding: 10px;
  border: 1px solid #999;
  border-radius: 6px;
  background-color: #00000027;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

textarea.auto-resize {
  min-height: 24px;
  width: 100%;
  resize: none;
  overflow: hidden;
  line-height: 1.4em;
  font-size: 14px;
  padding: 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}

.label-background {
  background-color: #01b7ff3f;
  border-radius: 6px;
  width: 90%;
  padding: 8px;
  display: flex;
  justify-content: center;
}

.if-background {
  background-color: #09ff013f;
  border-radius: 6px;
  width: 90%;
  padding: 8px;
  display: flex;
  justify-content: center;
}

.detail-background {
  background-color: #ff010167;
  border-radius: 6px;
  width: 90%;
  padding: 8px;
  display: flex;
  justify-content: center;
}

.then-background {
  background-color: #ff01d53f;
  border-radius: 6px;
  width: 90%;
  padding: 8px;
  display: flex;
  justify-content: center;
}

.label {
  word-break: break-word;
  word-wrap: break-word;
  white-space: normal;
  margin-bottom: 8px;
}

.label_if {
  word-break: break-word;
  word-wrap: break-word;
  white-space: normal;
  margin-bottom: 8px;
}

.label_then {
  word-break: break-word;
  word-wrap: break-word;
  white-space: normal;
  margin-bottom: 8px;
}

.left-group{
  display: flex;
  align-items: flex-start;
}

.input-group {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 6px;
}

.prefix {
  margin-bottom: 4px;
  font-weight: bold;
  font-size: 14px;
  color: #444;
}

input {
  width: 100%;
  padding: 5px;
  text-align: center;
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style>