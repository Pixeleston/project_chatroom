// callLLM.js
import fetch from 'node-fetch'
// npm install node-fetch
import { encoding_for_model } from '@dqbd/tiktoken'
import { LLM_CONFIG } from './src/config.js'
import { prompt_student, prompt_decide_small_part, prompt_double_check } from './src/prompt.js'
import { callLLM } from './src/callLLM.js'

import WebSocket from 'ws'

const socket = new WebSocket('ws://localhost:3000')

socket.on('open', () => {
  console.log('✅ student.js WebSocket 已連線')
})

function getOutgoingTargets(currentNodeId, stateDiagram) {
  const { nodes, edges } = stateDiagram
  const outgoingEdges = edges.filter(edge => edge.source === currentNodeId)
  const targetNodes = outgoingEdges
    .map(edge => nodes.find(node => node.id === edge.target))
    .filter(node => node !== undefined)

  return targetNodes
}

function getNodeById(diagram, id) {
  return diagram.nodes.find(n => n.id === id);
}

// for single student
export async function student_action(stateDiagram, history, student_profile){
  if(student_profile.name === 'Edison'){
    console.log("======== history ========")
    console.log(history)
  }

  let prompt = prompt_student(stateDiagram, history, student_profile)
  let actionSuccess = true

  let llmReply = await callLLM("gpt-4o", prompt, "[prompt_student]");
  if(!llmReply) return null  // [Bug] 已知此處有可能回傳null
  const cleanedReply = llmReply.replace(/^```json\s*|\s*```$/g, "");
    
  let result
  try {
    result = JSON.parse(cleanedReply.trim())
  } catch (err) {
    console.warn("❗ JSON.parse 失敗，試圖抽取物件")

    const match = cleanedReply.match(/\{[\s\S]*?\}/)
    if (!match) {
      actionSuccess = false
      throw new Error('❌ 無法解析 JSON：找不到大括號區塊')
    }
  
    try {
      result = JSON.parse(match[0])
    } catch (err2) {
      actionSuccess = false
      throw new Error('❌ 解析 JSON 區塊失敗：' + err2.message)
    }
  }

  const replyText = result.reply  ?? null;
  const why       = result.why    ?? '';
  const voting    = result.voting ?? null;

  if (replyText && replyText !== 'null') {
    const payload = {
      chatroom_type: 'simulator',
      msg_data: {
        role: 'user',
        user: student_profile.name || 'unknown-student',
        text: replyText,
        timestamp: new Date().toISOString()
      }
    }
    if (socket.readyState === WebSocket.OPEN && actionSuccess) {
      socket.send(JSON.stringify(payload))
    } else {
      console.warn('⚠️ socket 尚未連線，無法發送')
    }
  }
  
  if(stateDiagram.voting && voting && voting === "true"){
    // TODO 廣播到 server.mjs 裡面將此學生名字推入 stateDiagram.votingArray中
    const payload = {
      chatroom_type: 'simulator_voting',
      msg_data: {
        role: 'user',
        user: student_profile.name || 'unknown-student',
      }
    }
    if (socket.readyState === WebSocket.OPEN && actionSuccess) {
      socket.send(JSON.stringify(payload))
    } else {
      console.warn('⚠️ socket 尚未連線，無法發送')
    }
  }

  console.log(`replyText: ${replyText}\n why: ${why}\n`)
  return replyText
}