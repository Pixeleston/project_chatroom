<template>
  <div class="chat-area">
    <h3>Welcome, {{ username }}</h3>
    <div class="vote-results-panel">
      <h3>投票結果</h3>
      <ul v-if="diagram?.voting_array?.length > 0">
        <li v-for="(vote, index) in diagram.voting_array" :key="index">
          學生 {{ vote.user }} 已投票
        </li>
      </ul>
      <p v-else>
        目前非投票階段。
      </p>
    </div>
    <div class="messages">
      <div v-for="(msg, index) in allMessages" :key="index"
        :class="['message', msg.user === username ? 'me' : (msg.role === 'host' ? 'host' : '')]">
        <strong>{{ msg.user }}:</strong> {{ msg.text }}
      </div>
    </div>
    <div class="input-area">
      <input v-model="newMessage" @keyup.enter="sendMessage" placeholder="Type a message..." />
      <button @click="sendMessage">Send</button>
      <button @click="voting">同意</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ADDRESS_CONFIG } from '../config.js'
const props = defineProps(['username'])

import { useDiagramStore }  from '@/stores/diagramStore.js'

const diagram = useDiagramStore()

const messages = ref([])
const newMessage = ref('')
const allHistory = ref([])
const allMessages = ref([])
let socket

onMounted(() => {
  try {
    socket = new WebSocket(ADDRESS_CONFIG.WEBSOCKET_3000)

    socket.addEventListener('open', () => {
      console.log('✅ WebSocket connected')
    })

    socket.addEventListener('error', (err) => {
      console.error('❌ WebSocket error', err)
    })
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'diagramUpdated' && data.chatroom_type === 'chatroom') {
        diagram.nodes = data.diagram.nodes
        diagram.edges = data.diagram.edges
        diagram.currentNode = data.diagram.currentNode
        diagram.voting = data.diagram.voting
        diagram.memory = data.diagram.memory
        diagram.currentNodeSmall = data.diagram.currentNodeSmall
        diagram.voting_array = data.diagram.voting_array
      }
      else if(data.type === 'diagramClear'){
        allMessages.value = []
      }
    }

    socket.addEventListener('message', (e) => {
      try {
        const p = JSON.parse(e.data)
        if (p.type === 'history') {
          //messages.value.push(...p.data)
          if(p.chatroom_type === 'chatroom'){
            allHistory.value = p.data
            allMessages.value = p.data.flatMap(node => node.history)
            allMessages.value.sort((a, b) => a.timestamp - b.timestamp)
          }
        }
        else if (p.type === 'message') {
          //messages.value.push(p.data)
          if(p.chatroom_type === 'chatroom'){
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
  if (newMessage.value.trim()) {
    const timestamp = new Date().toISOString()
    const payload = {
      chatroom_type: "chatroom",
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
}

async function voting() {
  try {
    const res = await fetch(ADDRESS_CONFIG.ADDRESS_3000 + '/api/voting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: props.username })
    });

    const data = await res.json();
    if (data.success) {
      console.log('✅ 投票成功');
    } else {
      console.error('❌ 投票失敗', data.error);
    }
  } catch (err) {
    console.error('⚠️ 投票請求錯誤:', err);
  }
}

</script>

<style scoped>

.vote-results-panel {
  margin-top: 10px;
  border: 1px solid #ccc;
  padding: 16px;
  background-color: #f0f0f5;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
}
.vote-results-panel h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #333;
}
.vote-results-panel ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.vote-results-panel li {
  padding: 4px 0;
  border-bottom: 1px dashed #ddd;
}
.vote-results-panel li:last-child {
  border-bottom: none;
}

</style>