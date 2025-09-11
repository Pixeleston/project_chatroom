<template>
  <div class="student-container">
    <StudentCard
      v-for="(student, index) in students"
      :key="index"
      :student="student"
      @delete="() => deleteStudent(index)"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import StudentCreate from './StudentCreate.vue'
import StudentManage from './StudentManage.vue'
import StudentCard from './StudentCard.vue'

const showNewStudentPanel = ref(false)
const newStudentName = ref('')
const students = ref([])
const showStudentPanel = ref(false)
const showCreateStudent = ref(true)

onMounted(async () => {
  try {
    console.log('================== json start await ==================')
    const json = await fetch('http://localhost:3000/api/getStudent').then(r => r.json())
    console.log('================== json ==================')

    students.value = json

  } catch (e) {
    console.error('❌ 無法讀取 /api/diagramSimulator', e)
  }
})

async function deleteStudent(index) {
  if (confirm(`你確定要刪除 ${students.value[index].name} 嗎？`)) {
    students.value.splice(index, 1)
    const res = await fetch('http://localhost:3000/api/setStudent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(students.value)
    })

    const json = await res.json()

    if (res.ok) {
      console.log('✅ 刪除學生成功')
    } else {
      console.error('❌ 錯誤：', json.error)
    }
  }
}
</script>

<style scoped>
.new-student-panel {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid #aaa;
  background-color: #f9f9f9;
}

.student-container {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 10px;
  scroll-behavior: smooth;
  max-width: 1200px;
  margin: 0 auto;
}

</style>