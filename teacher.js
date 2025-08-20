// callLLM.js
import fetch from 'node-fetch'
// npm install node-fetch
import { encoding_for_model } from '@dqbd/tiktoken'
import { LLM_CONFIG } from './config.js'
import { prompt_teacher } from './prompt.js'
import { callLLM } from './callLLM.js'


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

export async function teacher_action(stateDiagram, hostMemory){

  const currentNode = stateDiagram.currentNode || 'start'
  const targets = getOutgoingTargets(currentNode, stateDiagram)

  let prompt = prompt_teacher(stateDiagram, currentNode, targets, hostMemory)

  console.log(`LLM Prompt： ${prompt}`)
    //.............................................

    let llmReply = await callLLM("gpt-4o", prompt);

    let result;
    try {
      result = JSON.parse(llmReply);
      console.log(llmReply)
    } catch (_) {
      const match = llmReply.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('LLM 沒有回傳 JSON');
      result = JSON.parse(match[0]);
    }

    // 抓出下一個節點

    // ===== TODO ===== //
    const replyText = result.reply ?? null;
    const nextNode = result.next;   // small big stay
  //  const nextNodeID = result.nextNode;
    const why       = result.why   ?? '';

    let replyMsg = null;
    let broadcastPayload = null
    // ===== TODO ===== //

    if (replyText && replyText !== 'null') {
      replyMsg = { user: 'Host', text: replyText };
      broadcastPayload = { type: 'message', data: replyMsg };
    }

    if (nextNode && nextNode !== 'stay') {
      
      // ===== TODO ===== //

    //  update_Memory();  // 
    //  decide_small_part();
      
      // ===== TODO ===== //

      stateDiagram.currentNode = nextNode;
      console.log(`➡️ 狀態轉移至: ${nextNode}（原因：${why}）`);
      broadcastPayload = { type: 'updateCurrentNode', data: nextNode };
    }
    // TODO -> needs to be updated here
    return {replyMsg, stateDiagram, broadcastPayload}
}