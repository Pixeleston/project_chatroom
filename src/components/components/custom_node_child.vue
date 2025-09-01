<template>
  <div class="custom-node-child" @mousedown.stop>
    <div class="label-background">
      <div class="label">{{ data.label }}</div>
    </div>
    <div class="theme-background">
      <div class="input-group">
        <div class="left-group">
          <span class="prefix">Users need to discuss</span>
        </div>
        <div class="label">{{ data.target }}</div>
      </div>
    </div>
    <div class="summary-background">
      <div class="input-group">
        <div class="left-group">
          <span class="prefix">Users' Summary</span>
        </div>
        <div class="label">{{ summary }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'

const props = defineProps({ data: Object, id: String })
const inputText = ref('')
const label = computed(() => props.data?.label ?? `Label error`)
const target = computed(() => props.data?.target ?? `Target error`)
const summary = computed(() => props.data?.summary ?? `No finished`)

</script>

<style scoped>
.custom-node-child {
  max-width: 300px;
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

.theme-background {
  background-color: #ff01d53f;
  border-radius: 6px;
  width: 90%;
  padding: 8px;
  display: flex;
  justify-content: center;
}

.summary-background {
  background-color: #09ff013f;
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