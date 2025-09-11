<template>
  <div class="student-card">
    <h3>{{ student.name }}</h3>
    <textarea :value="student.profile" readonly class="student-profile" />
    <button @click="$emit('delete')">🗑 刪除</button>
  </div>
</template>

<script setup>
defineProps(['student'])
defineEmits(['delete'])
</script>

<style>

.student-card {
  min-width: 300px;
  flex-shrink: 0;
  padding: 20px;
  background-color: #fefefe;
  border: 1px solid #ccc;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  white-space: pre-line;
}

.student-profile {
  width: 100%;
  max-width: 100%;
  resize: vertical;  /* 可以允許上下調整高度 */
  min-height: 350px;
  font-family: inherit;
  font-size: 14px;
  padding: 10px;
  border: 1px solid #aaa;
  border-radius: 6px;
  background: #f9f9f9;
  line-height: 1.5;
}
</style>