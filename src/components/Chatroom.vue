<template>
  <div class="chat-area">
    <h3>Welcome, {{ username }}</h3>
    <div class="messages">
      <div v-for="(msg, index) in messages" :key="index"
        :class="['message', msg.user === username ? 'me' : (msg.user === 'Host' ? 'host' : '')]">
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

function sendMessage() {
  if (newMessage.value.trim()) {
    socket.send(JSON.stringify({ user: props.username, text: newMessage.value }))
    newMessage.value = ''
  }
}
</script>