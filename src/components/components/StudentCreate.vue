<template>
  <div class="metrics-container">
    <div class="metrics-panel">
      <h2>模擬學生各項指標</h2>
      <input v-model="studentName" rows="1" class="name-input-area"/>
      <div class="metric">
        <label for="participation">Participation: </label>
        <input type="range" id="participation" v-model="participation" min="0" max="100" />
        <span>{{ participation }}</span>
      </div>

      <div class="metric">
        <label for="collaboration">Collaboration: </label>
        <input type="range" id="collaboration" v-model="collaboration" min="0" max="100" />
        <span>{{ collaboration }}</span>
      </div>

      <div class="metric">
        <label for="creativity">Creativity: </label>
        <input type="range" id="creativity" v-model="creativity" min="0" max="100" />
        <span>{{ creativity }}</span>
      </div>

      <button @click="spawnStudent" :disabled="spawn_cool">
        ➕ 生成模擬學生描述
      </button>
      <button @click="addStudent" :disabled="!studentDescription || !studentName">
        ➕ 新增模擬學生描述
      </button>
      <div v-if="addStudentErrorMessage" class="errorMessage">{{addStudentErrorMessage}}</div>
    </div>

    <div class="student-description">
      <h2>生成的學生描述</h2>
      <textarea v-model="studentDescription" rows="15" readonly />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const participation = ref(50)
const collaboration = ref(50)
const creativity = ref(50)

const spawn_cool = ref(false)
const studentDescription = ref('') // 存放LLM回覆
const studentName = ref('')
const addStudentErrorMessage = ref('')
const addStudentMessage = ref('')

async function spawnStudent() {
  if (spawn_cool.value) return

  try {
    const metrics = {
      Participation: participation.value,
      Collaboration: collaboration.value,
      Creativity: creativity.value,
    }

    spawn_cool.value = true
    const res = await fetch('http://localhost:3000/api/spawnStudent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics }),
    })
    spawn_cool.value = false

    const json = await res.json()

    if (res.ok) {
      console.log('✅ LLM 回覆：', json.reply)
      studentDescription.value = json.reply
      addStudentErrorMessage.value = ''
    } else {
      console.error('❌ 錯誤：', json.error)
      addStudentErrorMessage.value = json.error
    }
  } catch (err) {
    console.error('❌ 發送失敗：', err)
    spawn_cool.value = false
    addStudentErrorMessage.value = err
  }
}

async function addStudent() {
  if (!studentDescription.value.trim()) {
    alert("描述為空")
    return
  }

  try {
    const name = studentName.value || `Student-${Date.now()}`
    const res = await fetch('http://localhost:3000/api/addStudent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        profile: studentDescription.value,
      }),
    })

    const json = await res.json()
    console.log(res)
    if (res.ok) {
      if(json.success) {
        console.log('✅ 學生已加入模擬器')
        addStudentErrorMessage.value = ''
      }
      else {
        console.error('❌ 加入學生失敗：', json.error)
        addStudentErrorMessage.value = json.error
      }
    } else {
      console.error('❌ 加入學生失敗：', json.error)
      addStudentErrorMessage.value = json.error
    }
  } catch (err) {
    console.error('❌ 發送失敗：', err)
    addStudentErrorMessage.value = err
  }
}

async function loadStudent(){

}

</script>

<style scoped>
.metrics-container {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  margin: 20px;
}

.metrics-panel {
  max-width: 400px;
  padding: 20px;
  background: #f7f7f7;
  border-radius: 8px;
  flex-shrink: 0;
}

.metric {
  margin-bottom: 20px;
}

.metric label {
  display: inline-block;
  width: 120px;
  font-weight: bold;
}

.metric input[type="range"] {
  width: 150px;
  vertical-align: middle;
}

.metric span {
  margin-left: 10px;
  font-weight: bold;
}

.student-description {
  flex: 1;
  background: #fefefe;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 20px;
}

.errorMessage {
  color: #ff0303ff;
}

.student-description textarea {
  width: 100%;
  height: 100%;
  font-family: monospace;
  resize: none;
}

.name-input-area{display:flex;gap:8px}
.name-input-area input{flex:1;padding:10px}
.name-input-area button{padding:10px 16px}
</style>