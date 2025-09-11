<template>
  <div class="chat-area">

    <h3>學生討論總結</h3>
      <textarea v-model="detailText" 
          placeholder=""
          style="width: 100%; height: 200px; resize: vertical; box-sizing: border-box;"
          class="message"
        />
        <textarea v-model="reportText" 
          placeholder=""
          style="width: 100%; height: 200px; resize: vertical; box-sizing: border-box;"
          class="message"
        />
    <div class="messages">
      <div v-for="(msg, index) in history" :key="index"
        :class="['message', msg.user === username ? 'me' : (msg.role === 'host' ? 'host' : '')]">
        <strong>{{ msg.user }}:</strong> {{ msg.text }}
      </div>
    </div>
    <div class="input-area">
      <input v-model="newMessage" @keyup.enter="teacher_sendMessage" placeholder="Type a message..." />
      <button @click="teacher_sendMessage">Send</button>
      <button @click="teacher_apply">Apply Change</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useReportStore }  from '@/stores/reportStore.js'

const report = useReportStore()
// import { prompt_ask, prompt_spawn_example  } from '../prompt.js'
// import { callLLM } from '../callLLM.js'
const props = defineProps(['username'])

const newMessage = ref('')
let socket
const history = ref([{
    "role": "host",
    "user": "Host",
    "text": "哈囉大家好，我是聊天室的聊天機器人，請問您需要針對狀態圖的那些地方做修改建議呢?"
  }])
let latest_msg

const detailText = ref('')
const reportText = ref('')
const newnode_id = ref('')
const newnode_label = ref('')
const newnode_label_then = ref('')
const newnode_label_detail = ref('')
// const newnode_reply = ref('')

watch(() => report.detail, (newdetail) => {
  detailText.value = newdetail || ''
})

watch(() => report.detail, (newdetail) => {
  detailText.value = newdetail || ''
  console.log(report.report_text)
})

watch(() => report.report_text, (newtext) => {
  reportText.value = newtext
})

onMounted(() => {
  try {
    //history.value = []
    socket = new WebSocket('ws://localhost:3001')

    socket.addEventListener('open', () => {
      console.log('✅ WebSocket connected')
    })

    socket.addEventListener('error', (err) => {
      console.error('❌ WebSocket error', err)
    })

    reportText.value = report.report_text

  } catch (err) {
    console.error('❌ WebSocket connection failed:', err)
  }
})

async function teacher_sendMessage() {
  const tmp = newMessage.value
  sendMessage('user', 'teacher', newMessage.value)
  try {
    const res = await fetch('http://localhost:3000/api/chatroom_ask_improve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state_diagram: report.state_diagram,
        history: tmp // 你可以改成你實際放歷史訊息的變數
      })
    })

    const json = await res.json()

    if (json.result) {
      console.log('✅ LLM 回傳結果:', json.result)
      console.log(json.result.reply)
      // json.result 已經是完成解析的JSON了
      let adjustedReply = json.result.reply
      adjustedReply += `\n
      以下是修改過後的節點主題：${json.result.label}\n
      節點的target：${json.result.label_then}\n
      節點的detail：${json.result.label_detail}`
      sendMessage('host', 'Host', adjustedReply)

      newnode_id.value = json.result.id
      newnode_label.value = json.result.label
      newnode_label_then.value = json.result.label_then
      newnode_label_detail.value = json.result.label_detail

    } else {
      alert('❌ 後端未回傳 result 欄位')
    }

  } catch (err) {
    console.error('❌ API 呼叫失敗：', err)
    alert('❌ API 呼叫失敗：' + err.message)
  }
}

// 'user' , 'teacher', newMessage.value
function sendMessage(role, user, msg) {
  if (newMessage.value.trim() || msg) {
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
  }
}

//const newnode_id = ref('')
//const newnode_label = ref('')
//const newnode_label_then = ref('')
//const newnode_label_detail = ref('')

async function teacher_apply() {
  const report = useReportStore()

  const node = report.state_diagram.nodes.find(n => n.id === newnode_id.value)
  if (!node) {
    return
  }

  // 修改節點內容
  node.data.label_then = newnode_label_then.value
  node.data.label_detail = newnode_label_detail.value


  // 同步儲存回 server
  await report.saveToServer()
}

</script>