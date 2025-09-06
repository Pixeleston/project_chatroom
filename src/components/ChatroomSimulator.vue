<template>
  <div class="chat-area">
    <h3>模擬學生聊天室</h3>
    <div class="messages">
      <div v-for="(msg, index) in allMessages" :key="index"
        :class="['message', msg.user === username ? 'me' : (msg.role === 'host' ? 'host' : '')]">
        <strong>{{ msg.user }}:</strong> {{ msg.text }}
      </div>
    </div>
    <div class="input-area">
      <input v-model="newMessage" @keyup.enter="sendMessage" placeholder="Type a message..." />
      <button @click="sendMessage">Send</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const props = defineProps(['username'])

const messages = ref([])
const newMessage = ref('')
const allHistory = ref([])
const allMessages = ref([])
let socket

onMounted(() => {
  try {
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
        if (p.type === 'history') {
          //messages.value.push(...p.data)
          if(p.chatroom_type === 'simulator'){
            allHistory.value = p.data
            allMessages.value = p.data.flatMap(node => node.history)
            allMessages.value.sort((a, b) => a.timestamp - b.timestamp)
          }
        }
        else if (p.type === 'message') {
          //messages.value.push(p.data)
          if(p.chatroom_type === 'simulator'){
            allMessages.value.push(p.data)
          }
        }
      } catch (err) {
        console.error('⚠️ JSON parsing failed', err)
      }
    })
  } catch (err) {
    console.error('❌ WebSocket connection failed:', err)
  }
})

function sendMessage() {
  /*
  if (newMessage.value.trim()) {
    const timestamp = new Date().toISOString()
    const payload = {
      chatroom_type: "simulator",
      msg_data: {
        role: 'user',
        user: props.username,
        text: newMessage.value,
        timestamp: timestamp,
      }
    }

    socket.send(JSON.stringify(payload))
    newMessage.value = ''
  }
  */
}
</script>