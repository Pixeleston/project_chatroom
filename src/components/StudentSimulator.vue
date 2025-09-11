<template>
  <div>
    <!-- 控制面板顯示的按鈕 -->

    <button @click="showStudentPanel = !showStudentPanel">
      ➕ 展開學生面板
    </button>

    <button @click="showCreateStudent = true">
      ➕ 新增模擬學生
    </button>

    <button @click="showCreateStudent = false">
      ➕ 管理模擬學生
    </button>

    <button @click="resumeSimulator">
      ➕ 開始模擬
    </button>

    <button @click="pauseSimulator">
      ➕ 暫停模擬
    </button>

    <button @click="restartSimulator">
      ➕ 重新模擬
    </button>
    
    <button @click="report">
      ➕ 匯出報告
    </button>

    <!-- 新增面板 -->
    <div v-if="showNewStudentPanel" class="new-student-panel">
      <input v-model="newStudentName" placeholder="請輸入學生名稱" />
      <button @click="addNewStudent">確認新增</button>
    </div>
    <div v-if="showStudentPanel" class="student-panel">
      <StudentCreate v-if="showCreateStudent"/>
      <StudentManage v-else />
    </div>

    <!-- 顯示所有學生 -->
    <ul>
      <li v-for="(student, index) in students" :key="index">
        {{ student.name }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import StudentCreate from './components/StudentCreate.vue'
import StudentManage from './components/StudentManage.vue'

const showNewStudentPanel = ref(false)
const newStudentName = ref('')
const students = ref([])
const showStudentPanel = ref(false)
const showCreateStudent = ref(true)
const loadingReport = ref(false)


function addNewStudent() {
  if (newStudentName.value.trim()) {
    students.value.push({ name: newStudentName.value.trim() })
    newStudentName.value = ''
    showNewStudentPanel.value = false
  } else {
    alert('請輸入學生名稱')
  }
}

/*
async function toggleLLM() {
  const newVal = !LLM_TOGGLE.value
  const res = await fetch('http://localhost:3000/api/LLM_TOGGLE', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ LLM_TOGGLE: newVal })
  })
  const data = await res.json()
  LLM_TOGGLE.value = data.LLM_TOGGLE
}
*/

async function resumeSimulator(){
  const res = await fetch('http://localhost:3000/api/SIMULATOR_TOGGLE_OPEN', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ LLM_TOGGLE: true })
  })
}

async function pauseSimulator(){
  const res = await fetch('http://localhost:3000/api/SIMULATOR_TOGGLE_CLOSE', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ LLM_TOGGLE: false })
  })
}

function downloadJSON(data, filename = 'report.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function report() {
  loadingReport.value = true
  try {
    const res = await fetch('http://localhost:3000/api/spawnReport', {
      method: 'POST'
    })
    const json = await res.json()

    if (res.ok) {
    //  reportText.value = json.report.trim()
      downloadJSON(json, 'report.json')
    } else {
      console.error('❌ 產生報告失敗：', json.error)
    }
  } catch (err) {
    console.error('❌ API 錯誤：', err)
  } finally {
    loadingReport.value = false
  }
}

async function restartSimulator(){  // set state_diagram to initial state
  try {
    const res = await fetch('http://localhost:3000/api/restartSimulator', {
      method: 'POST',
    })

    const json = await res.json()

    if (res.ok && json.success) {
      console.log('✅ 模擬器已重置成功')
      // 可選：刷新畫面 / 清除UI狀態
    } else {
      console.error('❌ 模擬器重置失敗：', json.error || '未知錯誤')
    }
  } catch (err) {
    console.error('❌ 發送失敗：', err)
  }
}

</script>

<style scoped>
.student-panel {
  height: 500px;
  border: 1px solid #ccc;
  padding: 16px;
  overflow-y: auto;
  background-color: #f9f9f9;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-radius: 8px;
}
</style>