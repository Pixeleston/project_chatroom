<template>
  <div v-if="!username" class="login">
    <h2>Enter your name to join</h2>
    <input v-model="nameInput" placeholder="Your name">
    <button @click="enterChat">Enter</button>
  </div>
  <div v-else class="container">
      <div v-if="username==='admin'" class="sidebar">
        <button @click="toggleLLM">
        {{ LLM_TOGGLE ? '🟢 LLM 啟動中（點擊關閉）' : '🔴 LLM 已關閉（點擊開啟）' }}
        </button>
        <button @click="diagram_type = 'simulate'">🛠️ 模擬學生</button>
        <button @click="toggleDiagram">
          <img src="./assets/Barrier.png" style="width:20px; height:20px;" > 開關流程圖</img>
        </button>
        <button @click="diagram_type = 'edit'">🛠️ 編輯流程圖</button>
        <button @click="diagram_type = 'improve'">🛠️ LLM輔助修改流程圖</button>
        <button @click="diagram_type = 'display'">📄 檢視狀態圖</button>
        <button @click="diagram_type = 'test'">📄 測試prompt</button>
      </div>
      <div v-if="username!=='admin'" class="main-area">
        <div class="main-area">
          <div class="chat-area">
            <Chatroom :username="username" />
          </div>
        </div>
      </div>
      <div v-else class="main-area">
        <div v-if="showDiagram" class="diagram">
          <Diagram v-if="diagram_type === 'display'" ref="diagramRef" />
          <DiagramSimulator v-else-if="diagram_type === 'simulate'" />
          <DiagramImprove v-else-if="diagram_type === 'improve'"/>
          <DiagramEditor v-else />
        </div>
        <div class="chat-area">
          <Simulator v-if="diagram_type === 'simulate'"/>
          <ChatroomEditor v-else-if="diagram_type === 'edit'"/>
          <ChatroomImprove v-else-if="diagram_type === 'improve'"/>
          <Chatroom :username="username" v-else-if="diagram_type === 'display'"/>
          <TestPrompt v-if="diagram_type === 'test'"/>
        </div>
      </div>

      <div class="sidebar"></div>
  </div>
</template>

<script setup>
import { ref, markRaw, onMounted } from 'vue'
import Diagram from './components/Diagram.vue'
import Chatroom from './components/Chatroom.vue'
import ChatroomEditor from './components/ChatroomEditor.vue'
import DiagramEditor from './components/DiagramEditor.vue'
import DiagramImprove from './components/DiagramImprove.vue'
import ChatroomSimulator from './components/ChatroomSimulator.vue'
import ChatroomImprove from './components/ChatroomImprove.vue'
import DiagramSimulator from './components/DiagramSimulator.vue'
import Simulator from './components/Simulator.vue'
import TestPrompt from './components/TestPrompt.vue'
import { useDiagramStore } from '@/stores/diagramStore.js'
import { ADDRESS_CONFIG } from './config.js'

const username = ref('')
const nameInput = ref('')
const diagramRef = ref(null)
const showDiagram = ref(true)
const diagram_type = ref('display')

const diagram = useDiagramStore()

// 連線到 WebSocket Server（注意要使用正確 port）
const socket = new WebSocket(ADDRESS_CONFIG.WEBSOCKET_3000)


// 接收訊息
socket.addEventListener('message', (event) => {
  const packet = JSON.parse(event.data)

  if (packet.type === 'updateCurrentNode') {
    diagram.currentNode = packet.data
    console.log('🔁 前端收到新的 currentNode:', packet.data)
  }
})

function enterChat() {
  if (nameInput.value.trim()) {
    username.value = nameInput.value.trim()
  }
}

function toggleEdge() {
  //diagramRef.value?.toggleEdgeAnimation('e1')
  diagram_type.value = (diagram_type.value === 'create' ? 'display' : 'create')
}

function toggleDiagram() {
  showDiagram.value = !showDiagram.value
}



const LLM_TOGGLE = ref(true)
async function fetchToggle() {
  const res = await fetch(ADDRESS_CONFIG.ADDRESS_3000 + '/api/LLM_TOGGLE')
  const data = await res.json()
  LLM_TOGGLE.value = data.LLM_TOGGLE
}

async function toggleLLM() {
  const newVal = !LLM_TOGGLE.value
  const res = await fetch(ADDRESS_CONFIG.ADDRESS_3000 + '/api/LLM_TOGGLE', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ LLM_TOGGLE: newVal })
  })
  const data = await res.json()
  LLM_TOGGLE.value = data.LLM_TOGGLE
}

onMounted(() => {
  fetchToggle()
})

/*
const res = await fetch(ADDRESS_CONFIG.ADDRESS_3000 + '/api/LLM_TOGGLE', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ LLM_TOGGLE: true })
})

const text = await res.text()
try {
  const data = JSON.parse(text)
  LLM_TOGGLE.value = data.LLM_TOGGLE
} catch (e) {
  console.error('⚠️ 回傳不是合法 JSON:', text)
  alert('後端錯誤或回傳空白')
}
*/

</script>