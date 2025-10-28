
import { extractOutlinePrompt, extractDetailPrompt } from './src/promptSpawnDiagram.js'
import { callLLM } from './src/callLLM.js'

async function extractOutline(outline){  
  const prompt = extractOutlinePrompt(outline)
  let raw = await callLLM('gpt-4o', prompt, "[extractOutline()]")

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

async function extractDetail(outline, nodeArray) {
  const prompts = extractDetailPrompt(outline, nodeArray);

  let result = {
    start: "",
    array: []
  };

  try {
    // 取得開場白（第 0 個 prompt）
    let startResult = await callLLM('gpt-4o', prompts[0], "[extractDetail() start]");
    result.start = startResult?.trim() || "";

    // 逐步取得每個節點細節
    for (let i = 1; i < prompts.length; i++) {
      const _result = await callLLM('gpt-4o', prompts[i], `[extractDetail() step ${i}]`);
      result.array.push(_result?.trim() || "");
    }

  } catch (err) {
    console.error("❌ 解析失敗:", err);
  }

  console.log("✅ extractDetail 結果:", result);

  let detailArray = result.array || [];
  const start = result.start;
  let success = true;

  try {
    if (!Array.isArray(detailArray)) {
      throw new Error("回傳不是陣列");
    }
  } catch (err) {
    console.error("❌ 解析失敗:", err, "原始輸出:", result);
    detailArray = [];
    success = false;
  }

  if (detailArray.length !== nodeArray.length) {
    console.error(`❌ 細節陣列長度 (${detailArray.length}) 與流程陣列長度 (${nodeArray.length}) 不符`);
    success = false;
  }

  return { start, detailArray, success };
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

  let start = ""
  
  for (let i = 0; i < 5; i++) {
    const result = await extractDetail(outline, nodeArray)
    start = result.start
    detailArray = result.detailArray
    success = result.success
    if (success) break
  }

  if (!success) {
    throw new Error("無法成功解析出細節陣列")
  }
  console.log("細節陣列:", detailArray)
  console.log("start : ", start)

  // TODO 在vue頁面上顯示生成細節陣列的訊息
  

  // 3. 將兩陣列轉換成diagram
  // TODO
  return { nodeArray, detailArray, start }
}