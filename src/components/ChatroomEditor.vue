<template>
  <div class="chat-area">

    <div v-if="showPreview" class="modal-overlay">
  <div class="modal-content">
    <h3>🧩 預覽生成的流程圖</h3>

    <!-- 放預覽區（可以用小型 VueFlow） -->
    <VueFlow
      :key="showPreview"
      :nodes="previewData.nodes"
      :edges="previewData.edges"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :node-types="nodeTypes"
      :elements-selectable="false"
      fit-view
      style="width: 800px; height: 600px;"
    />

    <div class="modal-actions">
      <button @click="confirmImport">✅ 確定匯入</button>
      <button @click="cancelPreview">❌ 取消</button>
    </div>
  </div>
</div>

    <h3>目前選取的節點</h3>
    <div v-if="flow.selectedNode">
      <p><strong>ID:</strong> {{ flow.selectedNode.id }}</p>
      <p><strong>Label:</strong> {{ flow.selectedNode.data.label }}</p>
    </div>
    <div v-else>
      <p>尚未選取節點</p>
    </div>
    <!--
    <h3>Welcome, designer</h3>
      <textarea v-model="detailText" 
          placeholder=""
          style="width: 100%; height: 200px; resize: vertical; box-sizing: border-box;"
          class="message"
        />
    -->
    <h3>請輸入大綱</h3>
      <textarea v-model="outlineText" 
          placeholder=""
          style="width: 100%; height: 200px; resize: vertical; box-sizing: border-box;"
          class="message"
        />
      <button @click="spawnDiagram">Spawn Diagram</button>
    <div class="messages">
      <div v-for="(msg, index) in history" :key="index"
        :class="['message', msg.user === username ? 'me' : (msg.role === 'host' ? 'host' : '')]">
        <strong>{{ msg.user }}:</strong> {{ msg.text }}
      </div> 
    </div>
    <div class="input-area">
      <input v-model="newMessage" @keyup.enter="teacher_sendMessage" placeholder="Type a message..." />
      <button @click="teacher_sendMessage">Send</button>
      <button @click="spawnExample">Spawn Examples</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useFlowStore } from '@/stores/flowStore'
import { VueFlow, Panel, useVueFlow } from '@vue-flow/core'

import custom_node_condition from './components/custom_node_condition_edit.vue'
import custom_node_direct from './components/custom_node_direct_edit.vue'
import custom_node_start from './components/custom_node_start_edit.vue'

// import { prompt_ask, prompt_spawn_example  } from '../prompt.js'
// import { callLLM } from '../callLLM.js'
const props = defineProps(['username'])

const showPreview = ref(false)
const previewData = ref({ nodes: [], edges: [] })

const nodeTypes = {
  condition: custom_node_condition,
  direct: custom_node_direct,
  start: custom_node_start,
}

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
const outlineText = ref('')
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
    /*
    socket.addEventListener('message', (e) => {
      try {
        const p = JSON.parse(e.data)
        if (p.type === 'history') messages.value.push(...p.data)
        else if (p.type === 'message') messages.value.push(p.data)
      } catch (err) {
        console.error('⚠️ JSON parsing failed', err)
      }
    })
    */

  } catch (err) {
    console.error('❌ WebSocket connection failed:', err)
  }
})

function teacher_sendMessage(){
  sendMessage('user', 'teacher', newMessage.value)
}

// 'user' , 'teacher', newMessage.value
function sendMessage(role, user, msg) {
  //if (msg.trim()) {
    //socket.send(JSON.stringify({ role: 'user', user: props.username, text: newMessage.value }))
    history.value.push({ 
      role: role, 
      user: user, 
      text: msg
    })
    latest_msg = JSON.stringify({ 
      role: role, 
      user: user, 
      text: msg
    })
    newMessage.value = '';
 // }
}

async function spawnExample(){
  
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
    const res = await fetch('http://localhost:3000/api/chatroom_ask_spawn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedNode: flow.selectedNode, newMessage: newMessage.value})
    })
    const data = await res.json()
    sendMessage('host', 'AI assistant', data.result)
  }
  
}

async function saveToServer() {
  const data = {
    nodes: flow.nodes,
    edges: flow.edges,
  }
  try {
    await fetch('http://localhost:3000/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    alert('✅ 已儲存到伺服器')
  } catch (err) {
    alert('❌ 儲存失敗：' + err.message)
  }
}

function confirmImport() {
  // ✅ 使用者按「確定」後，才匯入主 VueFlow
  flow.nodes = previewData.value.nodes
  flow.edges = previewData.value.edges
  showPreview.value = false
  saveToServer()
}

function cancelPreview() {
  showPreview.value = false
}

async function spawnDiagram(){
  if (outlineText.value.trim()) {
    const res = await fetch('http://localhost:3000/api/spawn_diagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outline: outlineText.value})
    })
    console.log("wait111111")
    const data = await res.json()
    console.log("send!!!!!!")
    sendMessage('host', 'AI assistant', data.nodeArray)
    sendMessage('host', 'AI assistant', data.detailArray)

    const titles = data.nodeArray || [];
  const replies = data.detailArray || [];

  const nodes = [];
  const edges = [];

  // 1. 加入 start 節點
  const startNode = {
    id: "start",
    type: "start",
    initialized: false,
    position: { x: 50, y: 50 },
    data: {
      label: "start",
      label_then: "跟使用者說：哈囉大家好，我是聊天室的聊天機器人，我們要討論的是期末的Final Project，目標是打造一個軟體供使用者使用，請大家討論想做甚麼主題，像是網頁、遊戲等。",
      label_detail: "",
    }
  };
  nodes.push(startNode);

  for (let i = 0; i < titles.length; i++) {
    const node = {
      id: `node-${Date.now()}-${i}`,
      type: "direct",
      initialized: false,
      position: {
        x: 50 + (i % 2 === 0 ? -200 : 200),
        y: 360 + (i % 2 == 0 ? i / 2 * 300 : (i - 1) / 2 * 300)
      },
      data: {
        label: titles[i],
        label_then: replies[i],
        label_detail: "",
      }
    };
    nodes.push(node);
    const sourceId = i === 0 ? "start" : nodes[nodes.length - 2].id;
    const edge = {
      id: `e-${i + 1}`,
      type: "default",
      source: sourceId,
      target: node.id,
      sourceHandle: null,
      targetHandle: null,
      data: {},
      label: ""
    };
    edges.push(edge);
  }
  console.log("good");
    showPreview.value = true;
    previewData.value.nodes = nodes;
    previewData.value.edges = edges;
    previewData.value.currentNode = "start";
    previewData.value.voting = false;
    previewData.value.voting_array = [{}]
    //saveToServer();
  }
}

</script>

<style>

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
  text-align: center;
}

.modal-actions {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  gap: 10px;
}

</style>