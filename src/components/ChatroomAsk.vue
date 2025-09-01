<template>
  <div class="chat-area">

    <h3>目前選取的節點</h3>
    <div v-if="flow.selectedNode">
      <p><strong>ID:</strong> {{ flow.selectedNode.id }}</p>
      <p><strong>Label:</strong> {{ flow.selectedNode.data.label }}</p>
    </div>
    <div v-else>
      <p>尚未選取節點</p>
    </div>

    <h3>Welcome, designer</h3>
      <textarea v-model="detailText" 
          placeholder=""
          style="width: 100%; height: 200px; resize: vertical; box-sizing: border-box;"
          class="message"
        />
    <div class="messages">
      <div v-for="(msg, index) in history" :key="index"
        :class="['message', msg.user === username ? 'me' : (msg.role === 'host' ? 'host' : '')]">
        <strong>{{ msg.user }}:</strong> {{ msg.text }}
      </div>
    </div>
    <div class="input-area">
      <input v-model="newMessage" @keyup.enter="sendMessage" placeholder="Type a message..." />
      <button @click="sendMessage">Send</button>
      <button @click="spawnExample">Spawn Examples</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useFlowStore } from '@/stores/flowStore'
// import { prompt_ask, prompt_spawn_example  } from '../prompt.js'
// import { callLLM } from '../callLLM.js'
const props = defineProps(['username'])

const newMessage = ref('')
const flow = useFlowStore()
let socket
const history = ref([{
    "role": "host",
    "user": "Host",
    "text": "哈囉大家好，我是聊天室的聊天機器人，我們要討論的是期末的Final Project，目標是打造一個軟體供使用者使用，請大家討論想做甚麼主題，像是網頁、遊戲等。"
  }])
let latest_msg

const detailText = ref('')
watch(() => flow.selectedNode, (newNode) => {
  if (newNode && newNode.data) {
    history.value = []
    detailText.value = newNode.data.label_detail || ''
  }
})

watch(detailText, (newVal) => {
  const idx = flow.nodes.findIndex(n => n.id === flow.selectedNode.id)
  if (idx !== -1) {
    flow.nodes[idx].data.label_detail = newVal
  }
})

onMounted(() => {
  try {
    history.value = []
    socket = new WebSocket('ws://localhost:3001')

    socket.addEventListener('open', () => {
      console.log('✅ WebSocket connected')
    })

    socket.addEventListener('error', (err) => {
      console.error('❌ WebSocket error', err)
    })

    socket.addEventListener('message', (e) => {
      try {
        const p = JSON.parse(e.data)
        if (p.type === 'history') messages.value.push(...p.data)
        else if (p.type === 'message') messages.value.push(p.data)
      } catch (err) {
        console.error('⚠️ JSON parsing failed', err)
      }
    })
  } catch (err) {
    console.error('❌ WebSocket connection failed:', err)
  }
})

async function sendMessage() {
  if (newMessage.value.trim()) {
    //socket.send(JSON.stringify({ role: 'user', user: props.username, text: newMessage.value }))
    history.value.push({ 
      role: 'user', 
      user: 'teacher', 
      text: newMessage.value 
    })
    latest_msg = JSON.stringify({ 
      role: 'user', 
      user: 'teacher', 
      text: newMessage.value 
    })
    newMessage.value = '';
  }
}

async function spawnExample(){
  /*
  if (newMessage.value.trim()) {
    //socket.send(JSON.stringify({ role: 'user', user: props.username, text: newMessage.value }))
    history.value.push({ 
      role: 'user', 
      user: 'teacher', 
      text: newMessage.value 
    })
    latest_msg = JSON.stringify({ 
      role: 'user', 
      user: 'teacher', 
      text: newMessage.value 
    })
    let prompt = prompt_spawn_example(flow.selectedNode, newMessage.value )
    let llmReply = callLLM()
    newMessage.value = '';
  }
  */
}

</script>