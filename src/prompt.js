// npm install node-fetch
import { LLM_CONFIG } from './config.js'
const OPENAI_API_KEY = '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'

const headerPrompt = [
  `這是一個與 ... 的對話。... 是由 [組織名稱隱去] 研究團隊建立的協作型 AI 助手，基於 OpenAI 開發的 ChatGPT 5-mini 大型語言模型。

... 扮演雙重角色：

整體引導者 —— 根據人類設計的流程圖引導討論，確保團隊能朝著目標前進。

在地助手 —— 在每個步驟中協助參與者澄清觀點、引導深入思考，並在適當時提出想法，但不會主導或過度控制。

流程圖由人類設計，內容包括：

主要節點：討論過程中的高層步驟。

分支：每個步驟下的子情境，附有建議的回應策略。
你需要根據上下文判斷目前所處的「主要節點」和「分支」，並遵循該分支建議的方式回應。

... 可以參與多人對話，僅在有助於推動討論或符合分支指引時回應，並保持克制，不會過於頻繁或干擾。
不介入的情境包括：

訊息純屬社交、與討論目標無關。

分支明確標示「不需介入」。

... 不會在下列情況回覆：當一位使用者直接對另一位使用者說話、當有人自我介紹、或在腦力激盪階段僅是提出自己想法時（除非明確被點名或能提供有益介入）。

... 的身份是「參與者」，而不是「主持人」；不會嘗試控制討論。... 明白自己不完美，但會盡力誠實、準確地回應。
... 會積極參與，提供協作建議、建設性批評與新點子，但在沒有必要時保持安靜。

<FLOWCHART>
在這個系統中，討論流程圖（Flowchart）分為 **大節點** 與 **小節點**：

- **大節點**：由老師預先設計，包含大主題的定義與描述。整個群組討論會遵循這些大節點的順序進行。
- **小節點**：由 LLM 動態生成。每個小節點代表一個「問題 / 討論 / 結果」，它只會對應一個具體結論。

</FLOWCHART>

`
]

/*
每次使用者發言後，... 會生成一個 JSON 回應，包含：

source —— 發言者。

target —— 預期的對象，若非特定對象則填 "all"。不得與 source 相同。若訊息提到 ...，則 target = ...。

reply —— ... 若回覆會說的內容。

value —— 回覆的價值或適切性，0–100。

decision —— "<SUBMIT>" 或 "<PASS>"。若 target = ...，一律 "<SUBMIT>"。

若訊息是明確針對 ...，則不論價值高低必定 "<SUBMIT>"；否則若價值低，則保持 "<PASS>" 不回覆。例：有人單純貢獻腦力激盪想法，... 會 "<PASS>" 以避免重複。... 不會僅僅回覆「同意/不同意」，除非能補充有用訊息或提出問題。

... 的參與頻率應接近其他成員，避免過度發言。... 的回覆應保持簡短，與其他成員訊息長度接近。在腦力激盪時，僅提出一個建議，不重複或改述先前想法；在摘要時，應編號列出且只包含被要求的資訊。

... 不會主動開啟新對話，也不會自行宣布結束對話。當新對話開始時，不會保留前一段的任何細節。
*/

function getNodeById(diagram, id) {
  return diagram.nodes.find(n => n.id === id);
}

export function prompt_double_check(diagram, replyText, hostMemory){
    console.log(hostMemory)
    let history_string = ''
    try {
      if(hostMemory){
        if(hostMemory.length <= 0) history_string = '(目前聊天室無任何訊息)'
        else {
          hostMemory.forEach(msg => {
            history_string += `- ${msg}\n`
          })
        }
      }
      else {
        history_string = '(目前聊天室無任何訊息)'
      }
    }
    catch(err){
      history_string = '(目前聊天室無任何訊息)'
      console.log('failed')
      console.log(err)
    }
  
    let prompt = `
    以下是聊天室中使用者的歷史對話紀錄，以及LLM助手("Host")即將生成的回覆
    
    聊天室歷史訊息(最後出現的訊息為最新)：
    ${history_string}

    LLM即將生成的對話：
    ${replyText}

    目前diagram上的節點：
    ${diagram.currentNode}

    請你幫忙檢查一下LLM生成的對話是否有符合以下條件：
      - 即將生成的對話和最新自己說過的話高度相似
      - 在使用者(Host以外的使用者)討論正熱烈時突然插入對話
    
    若有符合以上條件，代表LLM目前不該發話，請回傳字串"false"
    若無符合，代表LLM應該發話，請回傳字串"true"

    若diagram上的節點為"start"，則強制判斷讓LLM發話
    若"Host"的最新訊息超過了3則，則強制判斷LLM不該發話
    
    此外，請再額外輸出一行如此判斷的原因
    `

    return prompt
}

export function prompt_decide_small_part(diagram, nextNodeID){  // 依照nextNodeID的教師prompt
  let nextNode = getNodeById(diagram, nextNodeID)
  let promptSummary = ``

  diagram.memory.nodesMemory.forEach(node => {
    promptSummary += `- ${node.label}\n`

    node.smallNodes.forEach(smallNode => {
      promptSummary += `      - ${smallNode.theme}：${smallNode.summary}\n`
    })
  }
)

//console.log(`nextNode ${nextNodeID}`)
//console.log(nextNode);
  //
  // - 細項討論：使用者要根據決定好的軟體主題，想出開發該軟體所需決定好的項目

  let prompt = `

    接下來要進行轉移大節點，請根據：
    - 老師提供的大節點描述
    - 以及之前的討論脈絡  
    LLM 必須輸出一個「建議討論清單（list）」。

    以下是目前學生先前討論完的議題總結(討論脈絡)：
    
    ${promptSummary}

    以下是教師提供的大節點描述：
    - ${nextNode.data.label}：${nextNode.data.label_then}

    請根據這些情況及教師對於新主題的需求，來決定學生在新主題中具體要討論的「主題」與「討論目標」。

    請使用以下 JSON 格式回應（不需其他說明），例如：
    {
      "topics": [
        { "theme": "網頁開發框架", "target": "使用者必須針對開發網頁討論出欲使用的框架" },
        { "theme": "開發日程", "target": "使用者需討論完成各階段開發所需的時間與排程" }
      ],
      "why": "這些主題能讓學生從『確定開發方向』邁向『具體分工與時程管理』，也呼應教師希望學生做出具體開發規劃的需求。"
    }`
    return prompt
}

export function prompt_teacher(stateDiagram, targets, hostMemory){
  let currentNode = stateDiagram.currentNode;
  let currentSmallNode = stateDiagram.currentNodeSmall;
  let diagram_edge_prompt = "以下是狀態圖中目前節點連出去的所有大節點："
    for (const node of targets){
      diagram_edge_prompt += `\n    - id : ${node.id}`
    }
    if (targets.length === 0){
      diagram_edge_prompt += '目前沒有可轉移出去的節點'
    }

    let memory_string = ""
    if (LLM_CONFIG.custom_memory) {
      memory_string = `\n以下是歷史對話：${hostMemory.join('\n')}\n歷史對話結束，請根據目前狀態圖及使用者對話給出回應與判斷：`
    }

    const currentNodeObj = stateDiagram.nodes.find(n => n.id === currentNode)

    let diagram_small_node_prompt = "- 以下為所在大節點內部的其他小節點："
    let currentNodeInMemory = stateDiagram.memory.nodesMemory.find(n => n.id === currentNode)
    let currentSmallNodes = null
    if(currentNodeInMemory) currentSmallNodes = currentNodeInMemory.smallNodes
    let currentSmallNodeObj = []

    if(currentSmallNodes){
      currentSmallNodeObj = currentSmallNodes.find(n => n.id === currentSmallNode)

      //console.log(currentSmallNodeObj);

      for(const node of currentSmallNodes){
          diagram_small_node_prompt += `- 節點 id : ${node.id}\n`
          diagram_small_node_prompt += `  - theme : ${node.theme}\n`
          diagram_small_node_prompt += `  - target : ${node.target}\n`
          diagram_small_node_prompt += `  - finish : ${node.finish}\n`
      }

      diagram_small_node_prompt += `
      - 目前所在小節點與目標
      `

      if(currentSmallNode != "null") diagram_small_node_prompt += `  - ${currentSmallNodeObj.target}\n`
      else diagram_small_node_prompt += ` - 目前不在任何小節點當中\n`
    }
    else diagram_small_node_prompt = `- 此大節點內部沒有小節點\n`

    const prompt = `
    ${headerPrompt}

    ${diagram_edge_prompt}

    以下是目前所在大節點的描述，以及所在的內部小節點，請根據此描述做出行動：
    - 大節點名稱： ${currentNodeObj.data.label}
    - 大節點ID：  ${currentNode}
    - 大節點目標：${currentNodeObj.data?.label_then || ""}
    ${diagram_small_node_prompt}

    你可以根據目前聊天室狀態來判斷是否轉移節點或說話
    ${memory_string}
    - 如果聊天室都沒什麼使用者在對話，可以引導使用者進行目前節點上的目標，如果還是沒有使用者回應，則可以停止回應，等待使用者發話
    - 如果目前主持人還沒提供小節點內的目標，請簡略說明並使用者討論
    - 主要是由使用者之間進行對話，請不要太頻繁發話
    - 請盡量不要介入使用者之間的對話，除非使用者有很明確的疑問或是詢問主持人
    
    - 若目前不在任何小節點上，則可以選擇一個小節點進行轉移
    - 若判斷目前小節點的目標已經完成，則可以轉移至下一個未完成的小節點，請注意不要轉移到currentSmallNode所記錄的小節點上。
    - 如果所有小節點都完成了，則可以轉移至下一個大節點，若當前節點無小節點，則只需判斷目前大節點的目標是否完成，完成則轉移至下一個大節點
    - 若目前大節點是start節點，則發完話就可以轉移至下一個大節點了

    請只輸出**合法且唯一的 JSON**，不要任何多餘文字、註解、markdown。
    JSON 結構如下：

    {
      "reply": "<string 或 null>",   // 要回給聊天室的文字，若不需發話請用 null
      "next": "<small 或 big 或 stay>"
      "nextNode":  "<string 或 \"stay\">", // 若next為small，則給出下一個小節點ID，若next為big，則給出下一個大節點ID，若next為stay，則給stay"
      "summary": "<string>", // 若next為small，請給出學生在目前完成的小節點所得出的總結，若next為其他字串則此處給null
      "why":   "<string>"             // 轉移或不轉移的理由，簡短說明
    }

    請確保 key 都存在，不要多 key，不要少 key。
    `

    // ===== TODO =====
    // 在prompt中新增 "nextSmall": "<string>"
    // ===== TOTO =====
  return prompt
}

export function prompt_ask(selectedNode, history, latest_msg){
  let prompt = `${headerPrompt}
    現在教師正在設計狀態圖的某個大節點，教師已將該節點目標設計完成，但仍需完善該節點細節，你需要根據教師

    以下為你和教師設計過程的對話紀錄：
    ${history}

    以下為當前設計的節點名稱、目標、以及目前設計的細節：
      - 名稱： ${selectedNode.data.label}
      - 目標： ${selectedNode.data.target}
      - 細節： ${selectedNode.data.detail}
    
    
  `
  return prompt
}

export function prompt_spawn_example(selectedNode, latest_msg){
  let prompt = `${headerPrompt}
    現在教師正在設計狀態圖的某個大節點，教師已將該節點目標設計完成，但仍需完善該節點細節。

    以下為教師提供的學生目前討論情況：
    ${latest_msg}

    以下為當前設計的節點名稱、目標、以及目前設計的細節：
      - 名稱： ${selectedNode.data.label}
      - 目標： ${selectedNode.data.target}
      - 細節： ${selectedNode.data.detail}

    你需要根據教師提供的學生目前討論情境，根據該情境以及目前的某個大節點內部資訊，生成一個範例的「建議討論清單（list）」

    請使用以下 JSON 格式回應（不需其他說明），例如：
    {
      "topics": [
        { "theme": "網頁開發框架", "target": "使用者必須針對開發網頁討論出欲使用的框架" },
        { "theme": "開發日程", "target": "使用者需討論完成各階段開發所需的時間與排程" }
      ],
      "why": "這些主題能讓學生從『確定開發方向』邁向『具體分工與時程管理』，也呼應教師希望學生做出具體開發規劃的需求。"
    }`
  return prompt
}

export function prompt_student(){
  
}