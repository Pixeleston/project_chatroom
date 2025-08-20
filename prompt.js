// callLLM.js
import fetch from 'node-fetch'
// npm install node-fetch
import { encoding_for_model } from '@dqbd/tiktoken'
import { LLM_CONFIG } from './config.js'
const OPENAI_API_KEY = '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'

const headerPrompt = [
  `你是這個聊天室的主持人，要用繁體中文與使用者互動。
  - 回應要友善、親切、有鼓勵性
  - 不要一次說太多話，請保持回覆簡短
  - 如果使用者不清楚問題，可以請他說得更清楚`
]

export function prompt_teacher(stateDiagram, currentNode, targets, hostMemory){
  let diagram_edge_prompt = "以下是狀態圖中目前節點連出去的所有節點，若符合if條件則可轉移過去："
    for (const node of targets){
      diagram_edge_prompt += `\n id : ${node.id} -> if (${node.data?.label_if || '（無法轉移）'})`
    }
    if (targets.length === 0){
      diagram_edge_prompt += '目前沒有可轉移出去的節點'
    }
        

    let memory_string = ""
    if (LLM_CONFIG.custom_memory) {
      memory_string = `\n以下是歷史對話：${hostMemory.join('\n')}\n歷史對話結束，請根據目前狀態圖及使用者對話給出回應與判斷：`
    }
    const currentNodeObj = stateDiagram.nodes.find(n => n.id === currentNode)
    let diagram_now_node_prompt = "以下是目前所在狀態的描述，請根據此描述做出行動："
    diagram_now_node_prompt += `${currentNodeObj.data?.label_then || ""}`

    const prompt = `
    你是這個聊天室的主持人，要用繁體中文與使用者互動。
    - 回應要友善、親切、有鼓勵性
    - 不要一次說太多話，請保持回覆精簡
    - 如果使用者不清楚問題，可以請他說得更清楚
    ${diagram_edge_prompt}
    ${diagram_now_node_prompt}

    你可以根據目前聊天室狀態來判斷是否轉移節點或說話。
    ${memory_string}
    - 如果聊天室都沒什麼使用者在對話，可以引導使用者進行目前節點上的目標，如果還是沒有使用者回應，則可以停止回應，等待使用者發話
    - 請不要重複說自己說過的話
    - 主要是由使用者之間進行對話，請不要太頻繁發話
    - 請盡量不要介入使用者之間的對話，除非使用者有很明確的疑問或是詢問主持人

    請只輸出**合法且唯一的 JSON**，不要任何多餘文字、註解、markdown。
    JSON 結構如下：

    {
      "reply": "<string 或 null>",   // 要回給聊天室的文字，若不需發話請用 null
      "next":  "<string 或 \"stay\">", // 下一個節點 id，或 "stay"
      "why":   "<string>"             // 轉移或不轉移的理由，簡短說明
    }

    請確保 key 都存在，不要多 key，不要少 key。
    `

    // ===== TODO =====
    // 在prompt中新增 "nextSmall": "<string>"
    // ===== TOTO =====

  return prompt
}

export function prompt_student(){
  
}