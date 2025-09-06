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

    <!-- 新增面板 -->
    <div v-if="showNewStudentPanel" class="new-student-panel">
      <input v-model="newStudentName" placeholder="請輸入學生名稱" />
      <button @click="addNewStudent">確認新增</button>
    </div>
    <div v-if"showStudentPanel">
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
import StudentCreate from './StudentCreate.vue'
import StudentManage from './StudentManage.vue'

const showNewStudentPanel = ref(false)
const newStudentName = ref('')
const students = ref([])
const showStudentPanel = ref(false)
const showCreateStudent = ref(true)

function addNewStudent() {
  if (newStudentName.value.trim()) {
    students.value.push({ name: newStudentName.value.trim() })
    newStudentName.value = ''
    showNewStudentPanel.value = false
  } else {
    alert('請輸入學生名稱')
  }
}

function resumeSimulator(){
  
}

function pauseSimulator(){

}

function restartSimulator(){  // set state_diagram to initial state

}

</script>

<style scoped>
.new-student-panel {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid #aaa;
  background-color: #f9f9f9;
}
</style>