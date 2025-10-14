
import { extractOutlinePrompt, extractDetailPrompt } from './src/promptSpawnDiagram.js'
import { callLLM } from './src/callLLM.js'

async function extractOutline(outline){  
  const prompt = extractOutlinePrompt(outline)
  let raw = await callLLM('gpt-4o', prompt)

  raw = raw.replace(/<END>\s*$/, '')

  const match = raw.match(/\[[\s\S]*\]/)  
  if (!match) {
    console.error("找不到陣列格式:", raw)
    return { nodeArray: [], success: false }
  }

  let arrStr = match[0]

  arrStr = arrStr.replace(/'/g, '"')

  let nodeArray = []
  let success = true
  try {
    nodeArray = JSON.parse(arrStr)
    if (!Array.isArray(nodeArray)) {
      throw new Error("回傳不是陣列")
    }
  } catch (err) {
    console.error("解析失敗:", err, "原始輸出:", arrStr)
    nodeArray = []
    success = false
  }

  return { nodeArray, success }
}

async function extractDetail(outline, nodeArray){  
  const prompt = extractDetailPrompt(outline, nodeArray)
  let raw = await callLLM('gpt-4o', prompt)

  raw = raw.replace(/<END>\s*$/, '')

  const match = raw.match(/\[[\s\S]*\]/)  
  if (!match) {
    console.error("找不到陣列格式:", raw)
    return { nodeArray: [], success: false }
  }

  let arrStr = match[0]

  arrStr = arrStr.replace(/'/g, '"')

  let detailArray = []
  let success = true
  try {
    detailArray = JSON.parse(arrStr)
    if (!Array.isArray(detailArray)) {
      throw new Error("回傳不是陣列")
    }
  } catch (err) {
    console.error("解析失敗:", err, "原始輸出:", arrStr)
    detailArray = []
    success = false
  }
  if(detailArray.length !== nodeArray.length){
    console.error(detailArray.length + " " + nodeArray.length);
    console.error("細節陣列長度與流程陣列長度不符")
    success = false;
  }

  return { detailArray, success }
}

export async function spawnDiagram(outline){
  let nodeArray = []
  let detailArray = []
  let success = false

  for (let i = 0; i < 5; i++) {
    const result = await extractOutline(outline)
    nodeArray = result.nodeArray
    success = result.success
    if (success) break
  }

  if (!success) {
    throw new Error("無法成功解析出流程陣列")
  }
  console.log("流程陣列:", nodeArray)

  // TODO 在vue頁面上顯示生成流程陣列的訊息
  
  // 2. 產生描述陣列
  
  for (let i = 0; i < 5; i++) {
    const result = await extractDetail(outline, nodeArray)
    detailArray = result.detailArray
    success = result.success
    if (success) break
  }

  if (!success) {
    throw new Error("無法成功解析出細節陣列")
  }
  console.log("細節陣列:", detailArray)

  // TODO 在vue頁面上顯示生成細節陣列的訊息
  

  // 3. 將兩陣列轉換成diagram
  // TODO
  return { nodeArray, detailArray }
}