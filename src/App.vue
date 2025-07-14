<template>
  <div v-if="!username" class="login">
    <h2>Enter your name to join</h2>
    <input v-model="nameInput" placeholder="Your name">
    <button @click="enterChat">Enter</button>
  </div>
  <div v-else class="container">
    <div class="sidebar">
      <button @click="toggleDiagram">
        <img src="./assets/Barrier.png" style="width:20px; height:20px;" > 開關流程圖</img>
      </button>
      <button @click="diagram_type = 'edit'">🛠️ 編輯流程圖</button>
      <button @click="diagram_type = 'display'">📄 檢視狀態圖</button>
    </div>

    <div class="main-area">
      <div v-if="showDiagram" class="diagram">
        <Diagram v-if="diagram_type === 'display'" ref="diagramRef" />
        <DiagramEditor v-else />
      </div>
      <div class="chat-area">
        <Chatroom :username="username" />
      </div>
    </div>

    <div class="sidebar"></div>
  </div>
</template>

<script setup>
import { ref, markRaw  } from 'vue'
import Diagram from './components/Diagram.vue'
import Chatroom from './components/Chatroom.vue'
import DiagramEditor from './components/DiagramEditor.vue'

const username = ref('')
const nameInput = ref('')
const diagramRef = ref(null)
const showDiagram = ref(true)
const diagram_type = ref('display')

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

</script>