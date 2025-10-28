// npm install node-fetch
import { LLM_CONFIG } from './config.js'

export function extractOutlinePrompt(outline){
  let prompt = `教師正在製作學生群組討論的大綱，裡面包含學生在討論時所需的各項流程以及詳細事項，以下為教師提供的大綱：
            ${outline}

            請將具體的討論主題按照順序條列出來，主題請回傳重點，不要太長，請回傳一個陣列以<END>結尾
            範例：['確認主題', '分配角色', '討論規則', '進行討論', '總結報告']<END>
  `
  return prompt;
}

export function extractDetailPrompt(outline, nodeArray){

  let prompt = []
  let _prompt = `
    教師正在製作學生群組討論的大綱，裡面包含學生在討論時所需的各項流程以及詳細事項。
    請依照這個大綱的內容來決定AI主持人開場要說甚麼話，讓學生對於這份專案如何討論有點頭緒。
    請回傳一個字串，範例：哈囉大家好，我是聊天室的聊天機器人，我們要討論的是...，目標是打造一個...。
  `
  prompt.push(_prompt)

  for(const theme of nodeArray){
    let _prompt = `
        以下為教師提供的大綱：
        ${outline}
        以及目前的操作流程：
        ${theme}

        教師正在製作學生群組討論的大綱，裡面包含學生在討論時所需的各項流程以及詳細事項，
        請從大綱中把目前流程的細節取出。

        請回傳一個字串，範例：明確了解討論的核心問題，確保每個成員都清楚今天的重點，避免討論分散。
    `
    prompt.push(_prompt)
  }
  return prompt;
}