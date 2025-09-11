// callLLM.js
import fetch from 'node-fetch'
// npm install node-fetch
import { encoding_for_model } from '@dqbd/tiktoken'
import { LLM_CONFIG } from './src/config.js'
import { prompt_teacher, prompt_decide_small_part, prompt_double_check } from './src/prompt.js'
import { callLLM } from './src/callLLM.js'


const OPENAI_API_KEY = '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'

const headerPrompt = [
  `你是這個聊天室的主持人，要用繁體中文與使用者互動。
  - 回應要友善、親切、有鼓勵性
  - 不要一次說太多話，請保持回覆簡短
  - 如果使用者不清楚問題，可以請他說得更清楚`
]

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

async function double_check(diagram, replyText, hostMemory){
  let prompt = prompt_double_check(diagram, replyText, hostMemory)
//  console.log(prompt);
  let llmReply = await callLLM("gpt-4o", prompt);
  if(!llmReply || llmReply.includes("true")) {
//    console.log("進入true")
//    console.log(llmReply)
    return "true";
  }
  else {
//    console.log("進入false")
//    console.log(llmReply)
    return "false";
  }
}

export async function decide_small_part(diagram, nextNodeID){  // 依照nextNodeID的教師prompt
    let prompt = prompt_decide_small_part(diagram, nextNodeID)
    let llmReply = await callLLM("gpt-4o", prompt);
    console.log("========== llmReply ==========");
    console.log(llmReply);
    console.log("========== llmReply ==========");

    const target = diagram.memory.nodesMemory.find(node => node.id === nextNodeID)
    if (target) {
      console.error("下一個節點的小節點已存在！");
      return { diagram, success: false };
    }

    const cleanedReply = llmReply.replace(/^```json\s*|\s*```$/g, "");
    let nextNode = getNodeById(diagram, nextNodeID)

  //   // 嘗試用正則抽取 JSON 區塊
  // const match = fixedReply.match(/\{[\s\S]*?"topics"\s*:\s*\[([\s\S]*?)\](.*?)\}/)
  // if (match) {
  //   try {
  //     result = JSON.parse(`{"topics":[${match[1]}]}`)
  //   } catch (err2) {
  //     actionSuccess = false
  //     throw new Error("❌ 修復後仍解析失敗：" + err2.message)
  //   }
  // } else {
  //   actionSuccess = false
  //   throw new Error("❌ 無法找出 topics 區塊")
  // }

    let result;
    try {
      result = JSON.parse(cleanedReply);

      const items = result.topics;
      const reason = result.why;

      if (!Array.isArray(items)) throw new Error("topics 不是陣列");

      const newSmallNodes = items.map((item, index) => ({
        id: `node-${Date.now()}-${index}`,
        theme: item.theme ?? "",
        target: item.target ?? "",
        summary: "",
        finish: false
      }));

      const newMemoryEntry = {
        id: nextNodeID,
        label: nextNode.data.label ?? "",
        smallNodes: newSmallNodes
      };

      diagram.memory.nodesMemory.push(newMemoryEntry);
      return { diagram, success: true };
    } catch (e) {
      console.error("❌ 解析失敗:", e);
      return { diagram, success: false };
    }
}

async function summarize(stateDiagram, summary){
  const currentNode = stateDiagram.currentNode;
  const currentSmallNode = stateDiagram.currentNodeSmall;
  if(currentSmallNode && currentSmallNode != 'null'){
    stateDiagram.memory.nodesMemory.find(n => n.id === currentNode).smallNodes.find(n => n.id === currentSmallNode).summary = summary;
    stateDiagram.memory.nodesMemory.find(n => n.id === currentNode).smallNodes.find(n => n.id === currentSmallNode).finish = true;
  }
  return stateDiagram;
}

export async function teacher_action(stateDiagram, hostMemory){

  console.log('teachers history : ')
  console.log(hostMemory)

  const currentNode = stateDiagram.currentNode || 'start'
  const targets = getOutgoingTargets(currentNode, stateDiagram)
  let actionSuccess = true

  let prompt = prompt_teacher(stateDiagram, targets, hostMemory)
  //const stop = ["}"]
    let llmReply = await callLLM("gpt-4o", prompt);
    console.log("teachers reply : " + llmReply)
    const cleanedReply = llmReply.replace(/^```json\s*|\s*```$/g, "");
    
let result
try {
  // 嘗試完整解析
  result = JSON.parse(cleanedReply.trim())
} catch (err) {
  console.warn("❗ JSON.parse 失敗，試圖抽取物件")

  // let fixedReply = cleanedReply
  // if (!fixedReply.trim().endsWith("}")) {
  //   fixedReply += "}"
  // }

  // // 嘗試用正則抽取 JSON 區塊
  // const match = fixedReply.match(/\{[\s\S]*?"topics"\s*:\s*\[([\s\S]*?)\](.*?)\}/)
  // if (match) {
  //   try {
  //     result = JSON.parse(`{"topics":[${match[1]}]}`)
  //   } catch (err2) {
  //     actionSuccess = false
  //     throw new Error("❌ 修復後仍解析失敗：" + err2.message)
  //   }
  // } else {
  //   actionSuccess = false
  //   throw new Error("❌ 無法找出 topics 區塊")
  // }
  // if (!match) {
  //   actionSuccess = false
  //   throw new Error('❌ 無法解析 JSON：找不到大括號區塊')
  // }
  
  // try {
  //   result = JSON.parse(match[0])
  // } catch (err2) {
  //   actionSuccess = false
  //   throw new Error('❌ 解析 JSON 區塊失敗：' + err2.message)
  // }
}


    // 抓出下一個節點

    const replyText = result.reply ?? null;
    
    const nextNode = result.next;   // small big stay
    const nextNodeID = result.nextNode;
    const nextReply = result.nextReply ?? null;
    const summary = result.summary;
    const why       = result.why   ?? '';
    
    // const replyText = null;
    // const nextNode = "small";   // small big stay
    // const nextNodeID = "node-1757473413405-0";
    // const nextReply = "現在，我們可以開始討論並確認期末專案的主題。請大家分享自己的想法，並達成一致。";
    // const summary = null;
    // const why       = "目前不在任何小節點，且需要進行大節點中的具體討論和確認主題，因此轉移到新的小節點進行專案主題的討論。";

    let replyMsg = { role: 'host', user: 'Host', text: replyText };
    let nextreplyMsg = null;

    let moveNode = null;
    
    if (replyText && replyText !== 'null' && nextNode === 'stay') {
      let check = await double_check(stateDiagram, replyText, hostMemory)  // errorable
      if(check === "false") {
        replyMsg = null;
      }
    }

    if (nextReply && nextReply !== 'null'){
      nextreplyMsg = { role: 'host', user: 'Host', text: nextReply };
    }



    if (nextNode && nextNode !== 'stay') {

    //  update_Memory();  // 

      let moveNodeSuccess = true;

      if(nextNode === "big"){
        const result = await decide_small_part(stateDiagram, nextNodeID);  // errorable
        if(!result.success) {
      //    console.log("========== result.success === false ==========")
          actionSuccess = false
        }
        const shouldSummarize = (stateDiagram.currentNode === 'start' ? false : true)
        stateDiagram = result.diagram;
        if(shouldSummarize){
          console.log(" ===== summarizing =====")
          console.log(stateDiagram.currentNode)
          stateDiagram = await summarize(stateDiagram, summary);
        }
        stateDiagram.currentNodeSmall = "null"
        moveNodeSuccess = result.success;
      }
      else if(nextNode === "small"){
        stateDiagram = await summarize(stateDiagram, summary);
      }
      console.log(`➡️ 狀態轉移至: ${nextNodeID}（原因：${why}）`);
      if(moveNodeSuccess) moveNode = { nextNode: nextNode, nextNodeID: nextNodeID };
    }
    // console.log("teachers reply : " + llmReply)
    // console.log(" ========== nextReplyMsg ==========");
    // console.log(nextreplyMsg);
    return {replyMsg, stateDiagram, moveNode, nextreplyMsg, actionSuccess}
}