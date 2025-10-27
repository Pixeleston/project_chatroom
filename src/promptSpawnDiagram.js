// npm install node-fetch
import { LLM_CONFIG } from './config.js'

export function extractOutlinePrompt(outline){
  let prompt = `教師正在製作學生群組討論的大鋼，裡面包含學生在討論時所需的各項流程以及詳細事項，請將具體的操作流程按照順序條列出來，並且回傳一個陣列以<END>結尾
            範例：['確認主題', '分配角色', '討論規則', '進行討論', '總結報告']<END>
            以下為教師提供的大綱：
            ${outline}
  `
  return prompt;
}

export function extractDetailPrompt(outline, nodeArray){
  let prompt = `

            以下為教師提供的大綱：
            ${outline}
            以及先前的操作流程陣列：
            ${JSON.stringify(nodeArray)}

            教師正在製作學生群組討論的大鋼，裡面包含學生在討論時所需的各項流程以及詳細事項，先前已將操作流程按照順序條列出來了，
            請從大綱中把每一個操作流程的細節照順序取出，並且同時依照這些流程的內容來決定AI主持人開場要說甚麼話，
            讓學生對於這份專案如何討論有點頭緒，開場話請放在接下來的json中的"start"欄位。

            請回傳以下JSON格式作為回應：
            {
              "start": '跟使用者說：哈囉大家好，我是聊天室的聊天機器人，我們要討論的是...，目標是打造一個...。'
              "array": ['明確了解討論的核心問題，確保每個成員都清楚今天的重點，避免討論分散。', '主持人負責引導流程，紀錄者整理意見，計時者確保時間分配合理，讓討論有秩序。']
            }
  `
  return prompt;
}