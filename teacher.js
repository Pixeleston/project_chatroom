// callLLM.js
import fetch from 'node-fetch'
// npm install node-fetch
import { encoding_for_model } from '@dqbd/tiktoken'
import { LLM_CONFIG } from './src/config.js'
import { SIMULATOR_CONFIG } from './src/config.js'
import { prompt_teacher, prompt_decide_small_part, prompt_double_check } from './src/prompt.js'
import { callLLM } from './src/callLLM.js'

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
  let llmReply = await callLLM("gpt-4o", prompt, "[prompt_double_check]");
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
    let llmReply = await callLLM("gpt-4o", prompt, "[decide_small_part()]");
    //console.log("========== llmReply ==========");
    //console.log(llmReply);
    //console.log("========== llmReply ==========");

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

// 若動作成功且轉移成功則回傳修改後的狀態圖，否則回傳原狀態圖
async function moveNode_action(stateDiagram, nextNode, nextNodeID, summary, why){
  let moveNodeSuccess = false;
  let newStateDiagram = stateDiagram;
    if (nextNode && nextNode !== 'stay') {
      let nodeExists = true;
      if(nextNode === "big"){
        nodeExists = newStateDiagram.nodes.some(node => node.id === nextNodeID);
        if(!nodeExists){  // 如果下一個大節點根本不存在，則直接跳過動作
          moveNodeSuccess = false;
          console.error(`❌ Host 決定轉移的節點 ID ${nextNode} 不存在於圖表中`);
        }
      }
      else if(nextNode === "small"){
        nodeExists = newStateDiagram.memory.nodesMemory.some(memoryNode =>
          memoryNode.smallNodes?.some(small => small.id === nextNodeID)
        );
        if(!nodeExists){  // 如果下一個小節點根本不存在，則直接跳過動作
          moveNodeSuccess = false;
          console.error(`❌ Host 決定轉移的節點 ID ${nextNode} 不存在於圖表中`);
        }
      }
      if(nodeExists){
    //  update_Memory();  // 

        moveNodeSuccess = true;

        if(nextNode === "big"){
          const result = await decide_small_part(newStateDiagram, nextNodeID);  // errorable
          if(!result.success) {
      //    console.log("========== result.success === false ==========")
            moveNodeSuccess = false
          }
          const shouldSummarize = (newStateDiagram.currentNode === 'start' ? false : true)
          newStateDiagram = result.diagram;
          if(shouldSummarize){
            console.log(" ===== summarizing =====")
            console.log(newStateDiagram.currentNode)
            newStateDiagram = await summarize(newStateDiagram, summary);
          }
          newStateDiagram.currentNodeSmall = "null"
          newStateDiagram.currentNode = nextNodeID
          moveNodeSuccess = result.success;
        }
        else if(nextNode === "small"){
          newStateDiagram = await summarize(newStateDiagram, summary);
          newStateDiagram.currentNodeSmall = nextNodeID
        }
        console.log(`➡️ 狀態轉移至: ${nextNodeID}（原因：${why}）`);
      }
    }
  if(moveNodeSuccess) return {stateDiagram: newStateDiagram, moveNodeSuccess}
  else return {stateDiagram: stateDiagram, moveNodeSuccess}
}

async function double_check_text(stateDiagram, hostMemory, replyMsg, replyText, nextNode){
  let newReplyMsg = replyMsg
  if (replyText && replyText !== 'null' && nextNode === 'stay') {
    let check = await double_check(stateDiagram, replyText, hostMemory)  // errorable
    if(check === "false") {
      newReplyMsg = null;
    }
  }
  return newReplyMsg
}

/*
let currentNodeInMemory = stateDiagram.memory.nodesMemory.find(n => n.id === currentNode)
if(currentNodeInMemory) currentSmallNodes = currentNodeInMemory.smallNodes
    let currentSmallNodeObj = []

    if(currentSmallNodes){
      currentSmallNodeObj = currentSmallNodes.find(n => n.id === currentSmallNode)

      for(const node of currentSmallNodes){
          diagram_small_node_prompt += `- 節點 id : ${node.id}\n`
          diagram_small_node_prompt += `  - theme : ${node.theme}\n`
          diagram_small_node_prompt += `  - target : ${node.target}\n`
          diagram_small_node_prompt += `  - finish : ${node.finish}\n`
      }
*/

// return { nextNode, nextNodeID, mustMove }  "big"  "node-xxxx-0"  true
// 假設此時必須轉移到下一個節點
function findNextNode(stateDiagram){
  const currentNode = stateDiagram.currentNode || 'start'
  const currentNodeSmall = stateDiagram.currentNodeSmall || 'null'
  const target = getOutgoingTargets(currentNode, stateDiagram)[0]

  let mustMove = false
  let nextNodeData = { nextNode: "stay", nextNodeID: "null", theme: "null", target: "null" }

  if(currentNodeSmall === "null") mustMove = true

  if(currentNode === "start"){
    nextNodeData = { nextNode: "big", nextNodeID: target.id, theme: target.data.label, target: target.data.label_then }
  }
  else { // 隨機找一個沒finish的，如果全finish就轉移big
    let currentNodeInMemory = stateDiagram.memory.nodesMemory.find(n => n.id === currentNode)
    let nextSmallCandidate = []
    let currentSmallNodes = []
    if(currentNodeInMemory) currentSmallNodes = currentNodeInMemory.smallNodes
    for(const node of currentSmallNodes){
      if(!node.finish && node.id !== currentNodeSmall){
        nextSmallCandidate.push(node)
      }
    }

    if(nextSmallCandidate.length == 0){  // 轉移到big
      nextNodeData = { nextNode: "big", nextNodeID: target.id, theme: target.data.label, target: target.data.label_then }
    }
    else {
      const randomIndex = Math.floor(Math.random() * nextSmallCandidate.length);
      nextNodeData = { nextNode: "small", nextNodeID: nextSmallCandidate[randomIndex].id, theme: nextSmallCandidate[randomIndex].theme, target: nextSmallCandidate[randomIndex].target }
    }
  }
  
  return { nextNodeData, mustMove }
}

export async function teacher_action(stateDiagram, hostMemory, student_profile){

  let student_count = student_profile.length
  let votingPass = false
  console.log("!!!!!!!!!!!!!!!!!!!!")
  console.log(stateDiagram.voting_array.length)
  console.log(student_count + " * " +  SIMULATOR_CONFIG.votingRatio)
  if(stateDiagram.voting_array.length >= student_count * SIMULATOR_CONFIG.votingRatio){
    votingPass = true
  }

  console.log('teachers history : ')
  console.log(hostMemory)

  const currentNode = stateDiagram.currentNode || 'start'
  const targets = getOutgoingTargets(currentNode, stateDiagram)
  let actionSuccess = true

  let { nextNodeData, mustMove } = findNextNode(stateDiagram)
  if(votingPass) mustMove = true  // 投票成功強制轉移

  let prompt = prompt_teacher(stateDiagram, targets, hostMemory, student_profile, nextNodeData, mustMove)
  //const stop = ["}"]
    let llmReply = await callLLM("gpt-4o", prompt, "[prompt_teacher]");
    console.log("teachers reply : " + llmReply)

    if(!llmReply) return {replyMsg:null, newStateDiagram:null, nextReplyMsg:null, actionSuccess:false, moveNodeSuccess:false, startVoting:false}
    
    const cleanedReply = llmReply.replace(/^```json\s*|\s*```$/g, "");
    
  let result
  try {
    // 嘗試完整解析
    result = JSON.parse(cleanedReply.trim())
  } catch (err) {
    console.warn("❗ JSON.parse 失敗，試圖抽取物件")
  }

  //let replyText = (result.reply ?? null); //result.reply_voting ?? (result.reply ?? null);
  //let nextReplyMsg = (result.nextReply ?? null);
  let startVoting = false;
  if (result.reply_voting && result.reply_voting !== 'null'){
    startVoting = true;
    result.reply = result.reply_voting // 這裡可以決定是否用reply_voting 來當作主持人回應
  }
  
  const replyText = (result.reply ?? null);
  const nextNode = nextNodeData.nextNode;   // small big stay
  const nextNodeID = nextNodeData.nextNodeID;
  const nextReply = result.nextReply ?? null;
  const summary = result.summary;
  const why       = result.why   ?? '';
  let replyMsg = { role: 'host', user: 'Host', text: replyText };
  let nextReplyMsg = { role: 'host', user: 'Host', text: nextReply };

  if(stateDiagram.currentNodeSmall === "null" || stateDiagram.currentNode === "start"){  // 特例，直接轉移節點
    startVoting = false; // 這種情況下不須開啟進入投票階段
    const { stateDiagram: newStateDiagram, moveNodeSuccess} = await moveNode_action(stateDiagram, nextNode, nextNodeID, summary, why)
    if(moveNodeSuccess) {
      return { replyMsg, stateDiagram: newStateDiagram, nextReplyMsg, actionSuccess, moveNodeSuccess, startVoting }
    }
    else {  // 在這種情況下，如果沒轉移成功則必定失敗 (actionSuccess = false)
      actionSuccess = false;
      return { replyMsg, stateDiagram: stateDiagram, nextReplyMsg, actionSuccess, moveNodeSuccess, startVoting }
    }
  }
  else if(stateDiagram.voting){ // 如果正在投票，那就看是否通過，沒通過就只需回傳replyMsg等，並回傳startVoting=false
    startVoting = false; // 這種情況下不須開啟進入投票階段

    if(votingPass){
      const { stateDiagram: newStateDiagram, moveNodeSuccess} = await moveNode_action(stateDiagram, nextNode, nextNodeID, summary, why)
      if(moveNodeSuccess) {
        return { replyMsg, stateDiagram: newStateDiagram, nextReplyMsg, actionSuccess, moveNodeSuccess, startVoting }
      }
      else {  // 在這種情況下，如果沒轉移成功則必定失敗 (actionSuccess = false)
        actionSuccess = false;
        return { replyMsg, stateDiagram: stateDiagram, nextReplyMsg, actionSuccess, moveNodeSuccess, startVoting }
      }
    }
    else {

      // host 再次自我確認是否應該說話
      replyMsg = double_check_text(stateDiagram, hostMemory, replyMsg, replyText, nextNode)

      return { replyMsg, stateDiagram: stateDiagram, nextReplyMsg, actionSuccess, moveNodeSuccess: false, startVoting}
    }
  }
  else {  // 沒在投票，不可能轉移節點

    // host 再次自我確認是否應該說話
    if(!startVoting) replyMsg = double_check_text(stateDiagram, hostMemory, replyMsg, replyText, nextNode)

    // startVoting = ???; // 唯一可能開啟進入投票階段的情況
    return { replyMsg, stateDiagram: stateDiagram, nextReplyMsg, actionSuccess, moveNodeSuccess: false, startVoting}
  }
}