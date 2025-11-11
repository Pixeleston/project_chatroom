// callLLM.js
import fetch from 'node-fetch'
// npm install node-fetch
import { encoding_for_model } from '@dqbd/tiktoken'
import { LLM_CONFIG } from './src/config.js'
import { SIMULATOR_CONFIG, REAL_CONFIG } from './src/config.js'
import { prompt_teacher, prompt_teacher_summary, prompt_teacher_real, prompt_teacher_summary_real, prompt_decide_small_part, prompt_double_check } from './src/prompt.js'
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
    if(nextNodeID === "end") {
      return { diagram, success: true };
    }

    let prompt = prompt_decide_small_part(diagram, nextNodeID)
    console.log(prompt)
    let llmReply = await callLLM("gpt-4o", prompt, "[decide_small_part()]");
    console.log(llmReply)
    //console.log("========== llmReply ==========");
    //console.log(llmReply);
    //console.log("========== llmReply ==========");

    const target = diagram.memory.nodesMemory.find(node => node.id === nextNodeID)
    if (target) {
      console.error("下一個節點的小節點已存在！");
      return { diagram, success: false };
    }

    let cleanedReply = llmReply.replace(/^```json\s*|\s*```$/g, "");

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

    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    cleanedReply = {
      "topics": [
        { "theme": "AI結合應用主題", "target": "討論出要打造甚麼AI應用程式" },
        { "theme": "使用者完成任務的痛點與效率問題", "target": "找出現有流程中的痛點或低效率處(因為發現現實中常常遇到甚麼問題，所以要打造這個應用)" },
        { "theme": "任務全流程", "target": "描繪使用者完成任務的全流程(使用者使用應用的過程)" },
        { "theme": "標示 AI 可介入的節點", "target": "討論出哪些步驟可以由 AI 預測、生成、推薦或自動化(AI如何介入)" }
      ],
      "why": "123123123"
    }
    cleanedReply = JSON.stringify(cleanedReply, null, 2)
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    let nextNode = getNodeById(diagram, nextNodeID)

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
      const randomIndex = 0  //Math.floor(Math.random() * nextSmallCandidate.length);
      nextNodeData = { nextNode: "small", nextNodeID: nextSmallCandidate[randomIndex].id, theme: nextSmallCandidate[randomIndex].theme, target: nextSmallCandidate[randomIndex].target }
    }
  }
  
  return { nextNodeData, mustMove }
}

export async function teacher_action(stateDiagram, hostMemory, student_profile){

  let student_count = student_profile.length
  let votingPass = false
 // console.log("!!!!!!!!!!!!!!!!!!!!")
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
  
  let replyText = (result.reply ?? null);
  const nextNode = nextNodeData.nextNode;   // small big stay
  const nextNodeID = nextNodeData.nextNodeID;
  const nextReply = result.nextReply ?? null;
  let summary = null;
  const why       = result.why   ?? '';
  let replyMsg = { role: 'host', user: 'Host', text: replyText };
  let nextReplyMsg = { role: 'host', user: 'Host', text: nextReply };

  if(stateDiagram.currentNode === "start") {
    const currentNodeObj = stateDiagram.nodes.find(n => n.id === "start")
    replyText = currentNodeObj.data.label_then
    replyMsg = { role: 'host', user: 'Host', text: replyText };
  }

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
      let prompt_summary = prompt_teacher_summary(stateDiagram, hostMemory)
      let llmReply = await callLLM("gpt-4o", prompt_summary, "[prompt_teacher_summary]");
      summary = llmReply  // llmReply 回傳summary字串

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

export async function teacher_action_real(stateDiagram, hostMemory){  // hostMemory includes all history

  let student_count = 3
  let votingPass = false
 // console.log("!!!!!!!!!!!!!!!!!!!!")
  console.log(stateDiagram.voting_array.length)
  console.log(student_count + " * " +  REAL_CONFIG.votingRatio)
  if(stateDiagram.voting_array.length >= student_count * REAL_CONFIG.votingRatio){
    votingPass = true
  }

  console.log('teachers history : ')
  console.log(hostMemory)

  const currentNode = stateDiagram.currentNode || 'start'
  const targets = getOutgoingTargets(currentNode, stateDiagram)
  let actionSuccess = true

  let { nextNodeData, mustMove } = findNextNode(stateDiagram)
  if(votingPass) mustMove = true  // 投票成功強制轉移
  else if(stateDiagram.currentNodeSmall !== "null" && stateDiagram.currentNode !== "start"){
    return {replyMsg:null, newStateDiagram:null, nextReplyMsg:null, actionSuccess:false, moveNodeSuccess:false}
  }

  let prompt = prompt_teacher_real(stateDiagram, targets, hostMemory, nextNodeData, mustMove)
  //const stop = ["}"]
    let llmReply = await callLLM("gpt-4o", prompt, "[prompt_teacher_real]");
    console.log("teachers reply : " + llmReply)

    if(!llmReply) return {replyMsg:null, newStateDiagram:null, nextReplyMsg:null, actionSuccess:false, moveNodeSuccess:false}
    
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
  
  //let replyText = (result.reply ?? null);
  let replyText = null;
  const nextNode = nextNodeData.nextNode;   // small big stay
  const nextNodeID = nextNodeData.nextNodeID;
  const nextReply = result.nextReply ?? null;
  let summary = null;//result.summary;
  const why       = result.why   ?? '';
  let replyMsg = { role: 'host', user: 'Host', text: "null" };
  let nextReplyMsg = { role: 'host', user: 'Host', text: nextReply };

  if(stateDiagram.currentNode === "start") {
    const currentNodeObj = stateDiagram.nodes.find(n => n.id === "start")
    replyText = currentNodeObj.data.label_then
    replyMsg = { role: 'host', user: 'Host', text: replyText };
  }

  if(stateDiagram.currentNodeSmall === "null" || stateDiagram.currentNode === "start"){  // 特例，直接轉移節點
    const { stateDiagram: newStateDiagram, moveNodeSuccess} = await moveNode_action(stateDiagram, nextNode, nextNodeID, summary, why)
    if(moveNodeSuccess) {
      return { replyMsg, stateDiagram: newStateDiagram, nextReplyMsg, actionSuccess, moveNodeSuccess }
    }
    else {  // 在這種情況下，如果沒轉移成功則必定失敗 (actionSuccess = false)
      actionSuccess = false;
      return { replyMsg, stateDiagram: stateDiagram, nextReplyMsg, actionSuccess, moveNodeSuccess }
    }
  }
  else if(stateDiagram.voting){ // 如果正在投票，那就看是否通過，沒通過就只需回傳replyMsg等，並回傳startVoting=false

    if(votingPass){
      let prompt_summary = prompt_teacher_summary_real(stateDiagram, hostMemory)
      let llmReply = await callLLM("gpt-4o", prompt_summary, "[prompt_teacher_summary_real]");
      summary = llmReply  // llmReply 回傳summary字串

      const { stateDiagram: newStateDiagram, moveNodeSuccess} = await moveNode_action(stateDiagram, nextNode, nextNodeID, summary, why)

      if(moveNodeSuccess) {
        return { replyMsg, stateDiagram: newStateDiagram, nextReplyMsg, actionSuccess, moveNodeSuccess }
      }
      else {  // 在這種情況下，如果沒轉移成功則必定失敗 (actionSuccess = false)
        actionSuccess = false;
        return { replyMsg, stateDiagram: stateDiagram, nextReplyMsg, actionSuccess, moveNodeSuccess }
      }
    }
    else {

      // host 再次自我確認是否應該說話
      //replyMsg = double_check_text(stateDiagram, hostMemory, replyMsg, replyText, nextNode)

      return { replyMsg, stateDiagram: stateDiagram, nextReplyMsg, actionSuccess, moveNodeSuccess: false}
    }
  }
  else {  // 沒在投票，不可能轉移節點

    // host 再次自我確認是否應該說話

    // startVoting = ???; // 唯一可能開啟進入投票階段的情況
    return { replyMsg, stateDiagram: stateDiagram, nextReplyMsg, actionSuccess, moveNodeSuccess: false}
  }
}


/*
  export function prompt_teacher_real(stateDiagram, targets, history, nextNodeData, mustMove){
    const { nextNode, nextNodeID, theme, target } = nextNodeData
    
    let student_count = 3
  
    let currentNode = stateDiagram.currentNode;
    let currentSmallNode = stateDiagram.currentNodeSmall;
    let pre_summary = `以下是使用者在聊天室目前為止討論的所有總結：\n`
    let history_string = "(目前聊天室沒有任何歷史紀錄)"
    history = history.slice(-(REAL_CONFIG.HISTORY_MESSAGE_COUNT))
    if(history) history_string = history.join('\n')
  
      let len = 0
      for (const memoryNode of stateDiagram.memory.nodesMemory) {
        for (const smallNode of memoryNode.smallNodes) {
          pre_summary += `       -${smallNode.summary} \n`
          len += 1
        }
      }
  
      if(len === 0) pre_summary += '       -（目前學生沒有討論完任何議題）\n'
  
      let memory_string = pre_summary
  
      memory_string += `\n以下是使用者在目前議題節點中的歷史對話：${history_string}\n歷史對話結束，請根據目前狀態圖及使用者對話給出回應與判斷：`
  
      const currentNodeObj = stateDiagram.nodes.find(n => n.id === currentNode)
  
      let diagram_small_node_prompt = ""
      let currentNodeInMemory = stateDiagram.memory.nodesMemory.find(n => n.id === currentNode)
      let currentSmallNodes = null
      if(currentNodeInMemory) currentSmallNodes = currentNodeInMemory.smallNodes
      let currentSmallNodeObj = []
  
      if(currentSmallNodes){
        currentSmallNodeObj = currentSmallNodes.find(n => n.id === currentSmallNode)
  
        diagram_small_node_prompt += `
        - 目前所在小節點與目標
        `
  
        if(currentSmallNode != "null") diagram_small_node_prompt += `  - **(重要)** ${currentSmallNodeObj.target}\n`
        else {
          diagram_small_node_prompt += ` - 目前不在任何小節點當中\n`
        }
      }
      else diagram_small_node_prompt = `- 此大節點內部沒有小節點\n`
  
      let prompt = `
      ${headerPrompt}
  
      以下是目前所在大節點的描述，以及所在的內部小節點，請根據此描述做出行動：
      - 大節點名稱： ${currentNodeObj.data.label}
      - 大節點ID：  ${currentNode}
      - 大節點目標：${currentNodeObj.data?.label_then || ""}
      ${diagram_small_node_prompt}
  
      你可以根據目前聊天室狀態來判斷是否說話
      ${memory_string}
  
      - 如果聊天室都沒什麼使用者在對話，可以引導使用者進行目前節點上的目標，如果還是沒有使用者回應，則可以停止回應，等待使用者發話
      - 如果目前主持人還沒提供小節點內的目標，請簡略說明引導使用者討論
      - 主要是由使用者之間進行對話，請不要太頻繁發話
      - 請盡量不要介入使用者之間的對話，除非使用者有很明確的疑問或是詢問主持人
      `
  
      let prompt_moveNode = ``
      let prompt_nextReply = ``
      //let prompt_summary = ``
      
      if(mustMove){
        prompt_moveNode = `
          - 下一個要轉移的節點主題是：${theme}
          - 要達成的目標是：${target}
          - 請根據以上資訊給出進入下個節點時的開場話作為 "nextReply"，不需要提到目前已完成xx議題，直接提下一個主題就好
        `
        prompt_nextReply = `// 請根據前面提到的資訊填寫此欄位`
        //prompt_summary = `// 請給出學生在目前完成的小節點所得出的總結`
      }
      else {
        prompt_nextReply = `// 請留空`
        //prompt_summary = `// 請留空`
      }
      
      // ** 特判 **
      if(stateDiagram.currentNode === "start") prompt_nextReply = `// 請留空`
  
      prompt += `
      ${prompt_moveNode}
  
      請只輸出**合法且唯一的 JSON**，不要任何多餘文字、註解、markdown。
      JSON 結構如下：
  
      {
        "reply": "<string 或 null>",  // 要回給聊天室的文字，若不需發話請用 null，如果剛完成了小節點的目標，可以說一些話像是：「看起來你們完成...的討論了，讓我們進入下一個議題討論吧」
        "reply_voting": "<string 或 null> // 請留空"
        "nextReply": "<string 或 null>" ${prompt_nextReply}
        "why":   "<string>"         // 給出以上回應的理由
      }
  
      請確保 key 都存在，不要多 key，不要少 key。
      `
  
    //   appendTeacherPromptLog({
    //   prompt
    // })
      if(DEBUG_CONFIG.consoleLogTeacherPrompt){
        console.log('prompt : ' + prompt)
      }
      return prompt
  }
  */