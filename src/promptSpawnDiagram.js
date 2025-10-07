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
  let prompt = `教師正在製作學生群組討論的大鋼，裡面包含學生在討論時所需的各項流程以及詳細事項，先前已將操作流程按照順序條列出來了，
            請從大綱中把每一個操作流程的細節照順序取出，並且回傳一個陣列以<END>結尾
            範例：['明確了解討論的核心問題，確保每個成員都清楚今天的重點，避免討論分散。', '主持人負責引導流程，紀錄者整理意見，計時者確保時間分配合理，讓討論有秩序。']<END>
            以下為教師提供的大綱：
            ${outline}
            以及先前的操作流程陣列：
            ${JSON.stringify(nodeArray)}
  `
  return prompt;
}