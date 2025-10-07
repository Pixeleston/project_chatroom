// npm install node-fetch
import { LLM_CONFIG } from './config.js'
import { callLLM } from './callLLM.js'
import fs from 'fs'

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

const headerPromptStudent = [
  `
  你目前正在參與某個議題的討論，你是其中一位參與者，你要和其他參與者一起合力完成討論
  聊天室中有一位主持人，名字為：Host，他主要的工作是引導參與者進行討論，他不會干涉太多
  嘗試聽從他的引導進行討論，並且和其他參與者溝通
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

function findMatchingNode(nodes, targetId, targetSmallId) {
  return nodes.find(n => n.id === targetId && n.small_id === targetSmallId)
}

export function filterHistory(diagram, history) {
  const id = diagram.currentNode
  const small_id = diagram.currentNodeSmall
  const matchedNodes = history.filter(
    n => (n.id === id && n.small_id === small_id) || n.id === 'start'
  )
  return matchedNodes.flatMap(n => n.history)
}

function getNodeById(diagram, id) {
  return diagram.nodes.find(n => n.id === id);
}

export function prompt_double_check(diagram, replyText, history){
    let history_string = ''
    try {
      if(history){
        if(history.length <= 0) history_string = '(目前聊天室無任何訊息)'
        else {
          history.forEach(msg => {
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


// === Relationship-Belief 生成/更新（純資料，不做 I/O） ===

// 亂數（可選 seed；不傳就用 Math.random）
export function _makePRNG(seed = null) {
  if (seed == null) return Math.random;
  let t = seed >>> 0;
  return function rand() {
    t ^= t << 13; t ^= t >>> 17; t ^= t << 5;
    return ((t >>> 0) / 4294967296);
  };
}
export function _randRange(rand, min, max) {
  return min + (max - min) * rand();
}

/**
 * 由學生名稱重建整份 relationship_belief 結構
 * @param {string[]} names
 * @param {object}   opts { seed?:number, symmetric?:boolean, relMin?:number, relMax?:number }
 * @returns {{members: Array<{name:string, belief:Object, relationship:Object}>}}
 */
export function rebuildRelationshipBeliefFromNames(names, opts = {}) {
  const {
    seed = Date.now(),
    symmetric = false,
    relMin = -1.0,
    relMax = 1.0
  } = opts;

  const rand = _makePRNG(seed);
  const members = names.map(n => ({ name: n, belief: {}, relationship: {} }));

  for (let i = 0; i < names.length; i++) {
    for (let j = 0; j < names.length; j++) {
      if (i === j) continue;
      if (symmetric && j < i) {
        // 鏡像
        members[i].relationship[names[j]] = members[j].relationship[names[i]];
      } else {
        members[i].relationship[names[j]] = Number(_randRange(rand, relMin, relMax).toFixed(3));
      }
    }
  }
  return { members };
}

/**
 * 在既有資料上，增量加入「新學生」，並補齊雙方關係
 * @param {{members:Array}} relData  既有 relationship_belief 資料（若無可傳 {members: []}）
 * @param {string[]} names           目前所有學生名稱（含新學生）
 * @param {string} newName           新學生名稱
 * @param {object} opts              { seed?:number, symmetric?:boolean, relMin?:number, relMax?:number }
 * @returns {{members:Array}}
 */
export function updateRelationshipBeliefOnNewStudentData(relData, names, newName, opts = {}) {
  const {
    seed = Date.now(),
    symmetric = false,
    relMin = -1.0,
    relMax = 1.0
  } = opts;

  const rand = _makePRNG(seed);
  const data = relData && Array.isArray(relData.members) ? relData : { members: [] };

  // 已存在就直接回傳
  if (data.members.some(m => m.name === newName)) return data;

  // 若完全沒有成員，退化成重建
  if (data.members.length === 0) {
    return rebuildRelationshipBeliefFromNames(names, { seed, symmetric, relMin, relMax });
  }

  // 先確保結構健全
  for (const m of data.members) {
    if (!m.belief || typeof m.belief !== 'object') m.belief = {};
    if (!m.relationship || typeof m.relationship !== 'object') m.relationship = {};
  }

  // 舊成員 -> 新同學（非對稱時這裡就隨機填；對稱等會鏡像）
  for (const m of data.members) {
    if (!symmetric) {
      m.relationship[newName] = Number(_randRange(rand, relMin, relMax).toFixed(3));
    }
  }

  // 新同學 -> 舊成員
  const newRel = {};
  for (const oldName of data.members.map(x => x.name)) {
    newRel[oldName] = Number(_randRange(rand, relMin, relMax).toFixed(3));
  }

  data.members.push({
    name: newName,
    belief: {},          // 一開始為空
    relationship: newRel
  });

  // 若對稱，做鏡像
  if (symmetric) {
    const map = new Map(data.members.map(m => [m.name, m]));
    for (const a of data.members) {
      for (const bName of Object.keys(a.relationship)) {
        const b = map.get(bName);
        if (!b) continue;
        const ab = a.relationship[bName];
        const ba = b.relationship?.[a.name];
        const val = (typeof ba === 'number') ? (ab + ba) / 2 : ab;
        a.relationship[bName] = Number(val.toFixed(3));
        b.relationship[a.name] = Number(val.toFixed(3));
      }
    }
  }

  return data;
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

    請用以下格式輸出，並完整輸出，不要省略、不用加註解、不用加說明：
    {
      "topics": [
        { "theme": "網頁開發框架", "target": "使用者必須針對開發網頁討論出欲使用的框架" },
        { "theme": "開發日程", "target": "使用者需討論完成各階段開發所需的時間與排程" }
      ],
      "why": "這些主題能讓學生從『確定開發方向』邁向『具體分工與時程管理』，也呼應教師希望學生做出具體開發規劃的需求。"
    }
    （請確保是有效 JSON，不要遺漏逗號或結尾大括號，內容不要中斷）

    該大節點的詳細描述，裡面可能含有範例，要生成哪些小節點請仔細查看細節：
    - ${nextNode.data.label_detail ? nextNode.data.label_detail:"(目前大節點無細節)"}

    `
    console.log(prompt)
    return prompt
}

export function prompt_teacher(stateDiagram, targets, history){
  let currentNode = stateDiagram.currentNode;
  let currentSmallNode = stateDiagram.currentNodeSmall;
  let diagram_edge_prompt = "以下是狀態圖中目前節點連出去的所有大節點："
  let pre_summary = `以下是使用者在聊天室目前為止討論的所有總結：\n`
  let history_string = "(目前聊天室沒有任何歷史紀錄)"
  if(history) history_string = history.join('\n')
    for (const node of targets){
      diagram_edge_prompt += `\n    - id : ${node.id}`
    }
    if (targets.length === 0){
      diagram_edge_prompt += '目前沒有可轉移出去的節點'
    }
    
    let len = 0
    for (const memoryNode of stateDiagram.memory.nodesMemory) {
      for (const smallNode of memoryNode.smallNodes) {
        pre_summary += `      -${smallNode.summary} \n`
        len += 1
      }
    }

    if(len === 0) pre_summary += '      -（目前學生沒有討論完任何議題）\n'

    let memory_string = pre_summary

    memory_string += `\n以下是使用者在新議題節點中的歷史對話：${history_string}\n歷史對話結束，請根據目前狀態圖及使用者對話給出回應與判斷：`

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
      "reply": "<string 或 null>",   // 要回給聊天室的文字，若不需發話請用 null，如果剛完成了小節點的目標，可以說一些話像是：「看起來你們完成...的討論了，讓我們進入下一個議題討論吧」
      "next": "<small 或 big 或 stay>"
      "nextNode":  "<string 或 \"stay\">", // 若next為small，則給出下一個小節點ID，若next為big，則給出下一個大節點ID，若next為stay，則給stay"
      "nextReply": "<string 或 null>" //若next為small，則給出進入下個小節點時的開場話，若next為stay或是big，則給null
      "summary": "<string>", // 若next為small，請給出學生在目前完成的小節點所得出的總結，若next為其他字串則此處給null
      "why":   "<string>"             // 轉移或不轉移的理由，簡短說明
    }

    請確保 key 都存在，不要多 key，不要少 key。
    `
    console.log('prompt : ' + prompt)
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

    你需要根據教師提供的學生目前討論情境，根據該情境以及目前的某個大節點內部目標、細節，生成一個範例的「議題節點清單」

    以下為當前設計的節點名稱、目標、以及目前設計的細節：
      - 名稱： ${selectedNode.data.label}
      - 目標（此大節點的討論大方向）： ${selectedNode.data.label_then}
      - 細節（請仔細依照此細節生成議題節點）： ${selectedNode.data.label_detail}

    請使用以下 格式回應（不需其他說明），例如：
    小節點1： 網頁開發框架， 目標： 使用者必須針對開發網頁討論出欲使用的框架\\n
    小節點2： 開發日程， 目標： 使用者需討論完成各階段開發所需的時間與排程\\n
    原因： 這些主題能讓學生從『確定開發方向』邁向『具體分工與時程管理』，也呼應教師希望學生做出具體開發規劃的需求。\\n
    `
  return prompt
}

export function prompt_spawn_student(metricsJson) {
  const metrics = JSON.parse(metricsJson)

  let prompt = `你現在要扮演一位模擬學生生成器，根據給定的能力指標和MBTI，生成這位學生的完整個性描述。\n`
  prompt += `MBTI以外的每項指標的範圍是 0 到 100，數值愈高表示能力愈強。\n`
  prompt += `MBTI指標有四個指標，每個指標分成兩項例如E人或I人，又分成強和弱，例如E強、I弱\n\n`

  prompt += `以下是該學生的能力指標：\n`
  for (const [key, value] of Object.entries(metrics)) {
    prompt += `- ${key}：${value}\n`
  }

  prompt += `\n請針對每項指標分別描述這位學生在課堂上的表現或行為特徵，內容請具體、自然、生動，能幫助人理解這位學生在團隊討論與專題合作時的樣貌。\n`

  prompt += `你可以參考以下範例格式（僅供參考，請根據實際指標數值靈活生成）：\n\n`

  prompt += `***** 範例輸入 *****\n`
  prompt += `- Participation：10\n`
  prompt += `- Collaboration：85\n`
  prompt += `- Creativity：90\n`
  prompt += `- Communication：60\n`
  prompt += `- Leadership：30\n\n`

  prompt += `以下為範例輸出，輸出JSON***僅需要***輸出文字敘述，***不需要***有任何輸入內容，例如MBTI和各個指標等，不需要有任何標題(學生自述)或標籤\n`
  prompt += `輸入完成請以<END>作結尾\n`
  prompt += `***** 範例輸出 *****\n`
  prompt += `他在團隊中多半保持安靜觀察的姿態，傾向在想法成熟後再發言，發言時往往能切中問題重點並引起他人共鳴。\n`
  prompt += `在合作上，他擅長傾聽與統整，能敏銳察覺團隊氛圍的變化，並在成員之間建立信任與共識，讓討論更流暢且有方向。\n`
  prompt += `他的創意豐富，善於從抽象構想中提煉具體可行的方案，特別能把理想與實務結合成具體步驟。\n`
  prompt += `在溝通上，表達清晰而有條理，能將複雜的想法轉化為團隊能理解的語言，偶爾在表達立場時略顯保守。\n`
  prompt += `雖然不常主導討論，但當團隊需要整合方向或陷入混亂時，他會主動站出來協調，幫助大家聚焦於共同目標。\n`
  prompt += `整體而言，他是一位兼具創造力與責任感的協作型成員，重視和諧與結構，擅長在冷靜與理想間找到平衡，推動團隊穩健前進。\n`
  prompt += `【人格傾向】他的人格特質接近 INFJ 型——內向、洞察力強、富有同理心且具結構思維，擅長在安靜思考中找出整體脈絡，並以溫和而堅定的方式帶領團隊向前。\n`
  prompt += `<END>\n` 
  prompt += `***** 範例輸出結束 *****\n`

  prompt += `請依照上述格式，根據實際指標，生成一段新的學生描述，並務必以<END>結尾：\n`

  return prompt
}



export function prompt_student(stateDiagram, history, student_profile){
  let memory_string = ""
  let history_string = "(目前聊天室沒有任何歷史紀錄)"
  if(history) history_string = history.join('\n')

  if (LLM_CONFIG.custom_memory) {
    memory_string = `\n以下是歷史對話：${history_string}\n歷史對話結束，請根據目前狀態圖及其他人的對話給出回應與判斷：`
  }

  // 若你有加「只影響學生」的社會脈絡區塊，就照你現有的做法組裝 socialDef/socialBlock
  const socialBlock = buildStudentSocialBlock?.(student_profile.name) || ''
  const socialDef   = typeof SOCIAL_DEFINITION_FOR_STUDENT === 'string' ? SOCIAL_DEFINITION_FOR_STUDENT : ''

  const prompt = `
    ${headerPromptStudent}

    ${socialDef}
    ${socialBlock}
    
    你的名字是： ${student_profile.name} ， 請注意不要和自己對話。
    以下是你所扮演的學生角色的各項指標，請根據指標與上面的社會脈絡來判斷是否發話，以及發話的內容為何：
    ${student_profile.profile}

    ${memory_string}

    請只輸出**合法且唯一的 JSON**，不要任何多餘文字、註解、markdown。
    **請使用中文回答**
    JSON 結構如下：

    {
      "reply": "<string 或 null>",
      "why":   "<string>"
    }

    請確保 key 都存在，不要多 key，不要少 key。
  `.trim();

  // ★ 新增：將 prompt 寫入 log（總表 + 每學生檔）
  appendStudentPromptLog({
    name: student_profile.name,
    prompt,
    stateDiagram
  });

  return prompt
}



export function prompt_spawn_report(stateDiagram) {
  const summaries = []

  for (const memoryNode of stateDiagram.memory.nodesMemory || []) {
    for (const smallNode of memoryNode.smallNodes || []) {
      if (smallNode.summary?.trim()) {
        summaries.push({
          theme: smallNode.theme,
          summary: smallNode.summary
        })
      }
    }
  }

  const prompt = `
  你是一位小組討論觀察者，以下是每個討論節點中所產出的「討論摘要」：

  ${summaries.map((s, i) => `【${i + 1}. ${s.theme}】\n${s.summary}`).join('\n\n')}

  請你根據上述摘要，撰寫一份完整的會議統整報告，請務必涵蓋所有摘要資訊。
  只需要輸出學生在各個議題上討論出了甚麼總結，不須輸出日期、名稱等無關的資訊。
  請以 "=== END ===" 結尾
  `

  return prompt
}

export function prompt_ask_improve(state_diagram, history) {
  let prompt_state_diagram = ''

  // 遍歷主節點
  for (const node of state_diagram.nodes ?? []) {
    prompt_state_diagram += `\n[主節點 ID: ${node.id}  主節點名稱: ${node.data.label} ]\n`
    prompt_state_diagram += `label_then: ${node.data.label_then}\n`
    prompt_state_diagram += `label_detail: ${node.data.label_detail}\n`
  }

  // 遍歷記憶體中的子節點
  for (const memoryNode of state_diagram.memory?.nodesMemory ?? []) {
    prompt_state_diagram += `\n[記憶體節點 ID: ${memoryNode.id}]\n`
    for (const sn of memoryNode.smallNodes ?? []) {
      prompt_state_diagram += `  - 小節點 Theme: ${sn.theme}\n`
      prompt_state_diagram += `    Target: ${sn.target}\n`
    }
  }
  
  const prompt_history = history
  ? history
  : '(無歷史紀錄)'

  //const prompt_history = history ?? ''

  const prompt = `
你是一個狀態圖改善者，以下是剛討論完某個議題的學生完成的狀態圖，每個 nodes 中有 label_then, label_detail，
代表使用者在這個 node 中要討論的目標，以及要討論時具體可能發生的細節：
${prompt_state_diagram}

以下是教師的要求訊息：
${history}

狀態圖中的 nodesMemory 裡面含有 LLM 在討論過程中根據 label_then, label_detail 生出的實際討論議題小節點。
教師在觀察完這些小節點後，希望你能夠透過修改某些 nodes 中的 label_then, label_detail 幫助 LLM 在下次討論過程中能生出更好的討論議題小節點。

⛔ 請注意：
- 一次最多僅修改一個主節點
- 請輸出該主節點的 id、新的 label_then、新的 label_detail
- 並額外輸出 reply：你要回應給教師的文字，用來說明你為什麼建議這樣修改，以及是否要徵詢教師是否同意

(**非常重要**)請注意：雖然目前的對話中使用者可能提及使用者實際討論出的情況作為一個例子（例如遊戲），但實際上他們仍有可能選擇設計其他類型的軟體（例如網站、應用程式等）。
因此，在你提出節點修改建議時，請避免針對特定主題（如遊戲）做出過度假設，而是給出能適用於多數軟體開發情境的更通用的建議方向。

請你回傳純 JSON 結構，內容如下，請以<END>結束：
請使用中文回答所有訊息

{
  "id": "要修改的主節點 id", // 如果沒有要修改的節點可以直接回傳null
  "label": "預修改的大節點名稱 label"
  "label_then": "修改後的新 label_then",
  "label_detail": "修改後的新 label_detail",
  "reply": "你回覆給教師的建議與詢問"
}
<END>
`

  return prompt.trim()
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

function safeParseLLMJson(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('empty LLM reply')
  let s = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = s.indexOf('{'), end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('no json braces')
  s = s.slice(start, end + 1)
  s = s.replace(/:\s*\+([0-9.]+)/g, ': $1')
  s = s.replace(/\uFF1A/g, ':')
  return JSON.parse(s)
}

function appendBeliefDebugLog({ prompt, raw, parsed, file='src/stores/simulator/belief_debug.log' }) {
  try {
    const line = [
      `\n===== ${new Date().toISOString()} =====`,
      `PROMPT:\n${prompt}`,
      `RAW:\n${raw}`,
      `PARSED:\n${JSON.stringify(parsed, null, 2)}`
    ].join('\n')
    fs.appendFileSync(file, line + '\n', 'utf8')
  } catch (e) {
    console.warn('[belief debug log] append fail:', e.message)
  }
}

// 將 LLM 回傳的 user key 最大程度對齊成員名
function normalizeUserKey(rawKey, memberNames) {
  if (rawKey == null) return null
  const kk = String(rawKey).trim()

  // 1) 直接命中
  if (memberNames.includes(kk)) return kk

  // 2) 純數字：先試是否剛好同名，再當 1-based index 對位
  if (/^\d+$/.test(kk)) {
    if (memberNames.includes(kk)) return kk
    const idx1 = parseInt(kk, 10) - 1
    if (idx1 >= 0 && idx1 < memberNames.length) return memberNames[idx1]
  }

  // 3) 鬆散比對（去空白/常見尾綴）
  const strip = (s) => String(s).replace(/\s+/g, '').replace(/同學$/,'')
  const loose = memberNames.find(n => strip(n) === strip(kk))
  if (loose) return loose

  return null
}

export async function updateBeliefWithLLM(latestMsg, history, REL_FILE, opts = {}) {
  const nHistory = opts.nHistory ?? 12
  const model = opts.model ?? 'gpt-4o'

  // 忽略 Host 的回合
  if (!latestMsg || latestMsg.user === 'Host' || latestMsg.role === 'host') {
    console.log('[belief] skip host turn')
    return
  }

  // 讀檔
  let data
  try {
    if (!fs.existsSync(REL_FILE)) {
      console.warn('[updateBeliefWithLLM] file not found:', REL_FILE)
      return
    }
    data = JSON.parse(fs.readFileSync(REL_FILE, 'utf8') || '{"members":[]}')
  } catch (e) {
    console.error('[belief] read/parse REL_FILE failed:', REL_FILE, e)
    return
  }
  if (!data || !Array.isArray(data.members) || data.members.length === 0) {
    console.warn('[updateBeliefWithLLM] no members to update')
    return
  }

  // 標準化結構與成員名
  for (const m of data.members) {
    m.name = String(m.name ?? '').trim()
    if (!m.belief || typeof m.belief !== 'object') m.belief = {}
    if (!m.belief.ideas || typeof m.belief.ideas !== 'object') m.belief.ideas = {}
  }
  const memberNames = data.members
    .map(m => m.name)
    .filter(n => n && n !== 'Host')

  console.log('[belief][debug] memberNames:', memberNames)

  // 最近對話（扁平）
  const recent = Array.isArray(history) ? history.slice(-nHistory) : []
  const transcript = [
    ...recent.map(m => `${m.user}: ${m.text}`),
    `(最新) ${latestMsg.user}: ${latestMsg.text}`
  ].join('\n')

  const prompt = `
你是小組互動觀察者。請先判斷這一輪是否需要更新（不是每句都有可更新的主題）。若需要，只允許輸出**一個**短詞 idea，並只針對該 idea 輸出每位成員的分數增量 delta（-1~+1，常見幅度 <= 0.3）。
規則：
- Host 發言只作為上下文參考，不可影響分數或新增想法。
- 成員鍵名只能用這些：${JSON.stringify(memberNames)}
- 只允許 1 個 idea；若沒有明確主題或立場/說服跡象，請不要更新。
- idea請主要以繁體中文表達
- 更新前先檢查是否有類似的idea存在，如果有請更新那個idea，不要再建立一個新的idea。
- delta 必須是合法 JSON 數字（不可有 "+" 字首）。

=== 對話（較新在下） ===
${transcript}
=== 結束 ===

請輸出**純 JSON**：
以下為範例
{
  "should_update": true,
  "repeat": false,
  "idea": "AI",
  "delta_by_user": {
    "Alice": 0.2,
    "Bob": -0.1
  },
  "reason": "為何需要/不需要更新/是否重複理由"
}
`

  // 呼叫 LLM
  let llmReply = ''
  try { llmReply = await callLLM(model, prompt) }
  catch (e) { console.error('[updateBeliefWithLLM] callLLM failed:', e); return }

  // 解析
  let parsed
  try { parsed = safeParseLLMJson(llmReply) }
  catch (e) { console.error('[updateBeliefWithLLM] parse LLM JSON failed. raw:', llmReply); return }

  appendBeliefDebugLog({ prompt, raw: llmReply, parsed })
  if (parsed?.reason) console.log('[belief][reason]:', parsed.reason)

  // 不更新的情況：若有 idea 仍先建 0 方便後續累積
  if (!parsed || parsed.should_update === false) {
    const ideaAdd = (typeof parsed?.idea === 'string') ? parsed.idea.trim() : ''
    if (ideaAdd) {
      for (const m of data.members) if (!(ideaAdd in m.belief.ideas)) m.belief.ideas[ideaAdd] = 0
      try { fs.writeFileSync(REL_FILE, JSON.stringify(data, null, 2), 'utf8') } catch {}
      console.log('[belief] this turn: ensure idea only ->', ideaAdd)
    } else {
      console.log('[belief] this turn: no update')
    }
    return
  }

  // 取單一 idea（必要）
  let idea = typeof parsed.idea === 'string' ? parsed.idea.trim() : ''
// —— 這段放在 updateBeliefWithLLM 內，取代「清洗 deltas」的程式 ——

// rawDeltas: 可能是 { "Alice": 0.2 } 或 { "Alice": { "AI": 0.2 } }
  const rawDeltas = parsed?.delta_by_user && typeof parsed.delta_by_user === 'object'
    ? parsed.delta_by_user
    : {}

  const cleanDeltas = {}  // 會變成 { "Alice": 0.2, "Bob": -0.1 } 這種單一數字形式

  for (const [userKey, val] of Object.entries(rawDeltas)) {
    // 先把 user key 對齊到成員名（你已經有 normalizeUserKey，就用它）
    const mappedUser = normalizeUserKey(userKey, memberNames)
    if (!mappedUser) {
      console.log('[belief] drop delta because cannot map user key:', userKey)
      continue
    }

    let num = null

    if (typeof val === 'number' && Number.isFinite(val)) {
      num = val
    } else if (typeof val === 'string' && Number.isFinite(Number(val))) {
      num = Number(val)
    } else if (val && typeof val === 'object') {
      // 舊格式或不規則物件
      if (Object.prototype.hasOwnProperty.call(val, idea)) {
        const v = Number(val[idea])
        if (Number.isFinite(v)) num = v
      } else {
        // 如果沒有 idea key，但物件裡只有一個數值屬性，也接受
        const numericValues = Object.values(val)
          .map(x => Number(x))
          .filter(x => Number.isFinite(x))
        if (numericValues.length === 1) num = numericValues[0]
      }
    }

    if (num == null) {
      console.log('[belief] drop delta for user (not numeric or no idea match):', userKey, val)
      continue
    }

    // 同一 user 多次出現就加總
    cleanDeltas[mappedUser] = (cleanDeltas[mappedUser] ?? 0) + num
  }

  console.log('[belief] selected idea:', idea)
  console.log('[belief] raw deltas:', rawDeltas)
  console.log('[belief] cleaned deltas (numbers):', cleanDeltas)

  if (Object.keys(cleanDeltas).length === 0) {
    console.log('[belief] no usable deltas; only ensure idea exists.')
    try { fs.writeFileSync(REL_FILE, JSON.stringify(data, null, 2), 'utf8') } catch {}
    return
  }

  // 實際套用（含 before/after log）
  for (const [user, deltaVal] of Object.entries(cleanDeltas)) {
    const member = data.members.find(m => m.name === user)
    if (!member) {
      console.log('[belief] member not found for:', user)
      continue
    }
    const before = Number(member.belief.ideas[idea] ?? 0)
    const after  = clamp(before + Number(deltaVal), -1, 1)
    member.belief.ideas[idea] = Number(after.toFixed(3))
    console.log(`[belief] ${user} on "${idea}": ${before} + (${deltaVal}) -> ${after}`)
  }


  // 寫檔
  try {
    fs.writeFileSync(REL_FILE, JSON.stringify(data, null, 2), 'utf8')
    console.log('[updateBeliefWithLLM] belief updated ->', REL_FILE)
  } catch (e) {
    console.error('[belief] write REL_FILE failed:', REL_FILE, e)
  }
}

// ===== Relationship：讓 LLM 依據最近對話微調成員關係（-0.1 ~ +0.1） =====

// 可共用你上面已有的工具：safeParseLLMJson / appendBeliefDebugLog / normalizeUserKey / clamp

function appendRelationshipDebugLog({ prompt, raw, parsed, file='src/stores/simulator/relationship_debug.log' }) {
  try {
    const line = [
      `\n===== ${new Date().toISOString()} =====`,
      `PROMPT:\n${prompt}`,
      `RAW:\n${raw}`,
      `PARSED:\n${JSON.stringify(parsed, null, 2)}`
    ].join('\n')
    fs.appendFileSync(file, line + '\n', 'utf8')
  } catch (e) {
    console.warn('[relationship debug log] append fail:', e.message)
  }
}

/**
 * 讓 LLM 判斷是否要更新成員間的關係分數（-1 ~ +1），每輪只允許微幅調整（Δ ∈ [-0.1, +0.1]）
 * - 忽略 Host 的影響（Host 不參與關係變動）
 * - 只更新出現在 delta_by_pair 的那些 pair，沒出現的不動
 * - 預設為「非對稱」：A 對 B 的感受不一定等於 B 對 A（若要強制對稱，用 opts.symmetric = true）
 *
 * relationship_belief.json 結構（沿用你現有的）：
 * {
 *   "members": [
 *     {
 *       "name": "Alice",
 *       "belief": { "ideas": {...} },
 *       "relationship": { "Bob": 0.12, "Carol": -0.05, ... }
 *     },
 *     ...
 *   ]
 * }
 */
export async function updateRelationshipWithLLM(latestMsg, history, REL_FILE, opts = {}) {
  const nHistory = opts.nHistory ?? 12
  const model = opts.model ?? 'gpt-4o'
  const magnitudeMax = opts.magnitudeMax ?? 0.1  // 每輪最大微調
  const symmetric = !!opts.symmetric             // 是否強制對稱

  // 忽略 Host 自己發話的這輪（但會用於上下文）
  if (!latestMsg || latestMsg.user === 'Host' || latestMsg.role === 'host') {
    console.log('[relationship] skip host turn')
    return
  }

  // 讀檔 & 基本檢查
  let data
  try {
    if (!fs.existsSync(REL_FILE)) {
      console.warn('[updateRelationshipWithLLM] file not found:', REL_FILE)
      return
    }
    data = JSON.parse(fs.readFileSync(REL_FILE, 'utf8') || '{"members":[]}')
  } catch (e) {
    console.error('[relationship] read/parse REL_FILE failed:', REL_FILE, e)
    return
  }
  if (!data || !Array.isArray(data.members) || data.members.length === 0) {
    console.warn('[updateRelationshipWithLLM] no members')
    return
  }

  // 標準化結構
  for (const m of data.members) {
    m.name = String(m.name ?? '').trim()
    if (!m.belief || typeof m.belief !== 'object') m.belief = {}
    if (!m.relationship || typeof m.relationship !== 'object') m.relationship = {}
  }

  // 只取非 Host 的成員名單
  const memberNames = data.members.map(m => m.name).filter(n => n && n !== 'Host')
  console.log('[relationship][debug] memberNames:', memberNames)

  // 準備 transcript
  const recent = Array.isArray(history) ? history.slice(-nHistory) : []
  const transcript = [
    ...recent.map(m => `${m.user}: ${m.text}`),
    `(最新) ${latestMsg.user}: ${latestMsg.text}`
  ].join('\n')

  // 提示 LLM：只回 JSON、不要 code fence；delta 要在 [-0.1, +0.1]
  const prompt = `
你是小組互動觀察者。請閱讀以下多人討論的片段，判斷是否需要微幅更新成員間的關係分數（-1 ~ +1）。
若需要更新，只輸出有變化的「人際方向」(A 對 B)，每個增量 delta 限制在 [-${magnitudeMax}, +${magnitudeMax}] 之間。
規則：
- Host 僅作為上下文，不可列入/影響關係分數。
- 只允許使用下列成員作為鍵名：${JSON.stringify(memberNames)}
- 關係是「有方向的」：A 對 B 不一定等於 B 對 A（若你判斷兩邊都變動，可各自輸出）。
- 若本輪缺乏互動/情緒線索（同意/致謝/讚同/反駁/否定/指責/打斷/忽視/合作/支持等），請不要更新。
- 僅輸出需要變動的 pair；沒有變更就省略，不要硬湊。

參考的互動線索（僅供你判斷，請勿額外輸出）：
- 正向：表示支持/同意、稱讚、感謝、主動回應對方問題、採納建議、協作順暢
- 負向：否定/反對且語氣強烈、冷落對方、打斷、指責、嘲諷、拒絕合作

=== 對話（較新在下） ===
${transcript}
=== 結束 ===

請輸出**純 JSON**（不要 markdown）：例如
{
  "should_update": true,
  "delta_by_pair": {
    "Alice": { "Bob": 0.05, "Carol": -0.02 },
    "Bob": { "Alice": 0.03 }
  },
  "reason": "為何需要或不需要更新（可略）"
}
若不更新：
{ "should_update": false, "reason": "…" }
`

  // 呼叫 LLM
  let llmReply = ''
  try { llmReply = await callLLM(model, prompt) }
  catch (e) { console.error('[updateRelationshipWithLLM] callLLM failed:', e); return }

  // 解析
  let parsed
  try { parsed = safeParseLLMJson(llmReply) }
  catch (e) { console.error('[updateRelationshipWithLLM] parse LLM JSON failed. raw:', llmReply); return }

  appendRelationshipDebugLog({ prompt, raw: llmReply, parsed })
  if (parsed?.reason) console.log('[relationship][reason]:', parsed.reason)

  if (!parsed || parsed.should_update === false) {
    console.log('[relationship] this turn: no update')
    return
  }

  // 清洗 delta_by_pair
  const rawPairs = parsed?.delta_by_pair && typeof parsed.delta_by_pair === 'object'
    ? parsed.delta_by_pair
    : {}

  // 轉成標準 { srcName: { dstName: number } }，過濾 Host、自身、非名單
  const cleanPairs = {}
  for (const [srcKey, m] of Object.entries(rawPairs)) {
    const src = normalizeUserKey(srcKey, memberNames)
    if (!src) continue
    if (!m || typeof m !== 'object') continue

    for (const [dstKey, v] of Object.entries(m)) {
      const dst = normalizeUserKey(dstKey, memberNames)
      if (!dst) continue
      if (dst === src) continue   // 不對自己

      const num = Number(v)
      if (!Number.isFinite(num)) continue

      // 夾在 [-magnitudeMax, +magnitudeMax]
      const delta = Math.max(-magnitudeMax, Math.min(magnitudeMax, num))

      if (!cleanPairs[src]) cleanPairs[src] = {}
      cleanPairs[src][dst] = (cleanPairs[src][dst] ?? 0) + delta
    }
  }

  console.log('[relationship] raw pairs:', rawPairs)
  console.log('[relationship] cleaned pairs:', cleanPairs)

  if (Object.keys(cleanPairs).length === 0) {
    console.log('[relationship] nothing to update after cleaning')
    return
  }

  // 實際套用（含 before/after log）
  const name2member = new Map(data.members.map(m => [m.name, m]))
  for (const [src, dstMap] of Object.entries(cleanPairs)) {
    const srcM = name2member.get(src)
    if (!srcM) continue
    if (!srcM.relationship || typeof srcM.relationship !== 'object') srcM.relationship = {}

    for (const [dst, d] of Object.entries(dstMap)) {
      const before = Number(srcM.relationship[dst] ?? 0)
      const after = clamp(before + Number(d), -1, 1)
      srcM.relationship[dst] = Number(after.toFixed(3))
      console.log(`[relationship] ${src} -> ${dst}: ${before} + (${d}) -> ${after}`)

      if (symmetric) {
        const dstM = name2member.get(dst)
        if (dstM) {
          const before2 = Number(dstM.relationship?.[src] ?? 0)
          const after2  = clamp(before2 + Number(d), -1, 1)
          if (!dstM.relationship || typeof dstM.relationship !== 'object') dstM.relationship = {}
          dstM.relationship[src] = Number(after2.toFixed(3))
          console.log(`[relationship][sym] ${dst} -> ${src}: ${before2} + (${d}) -> ${after2}`)
        }
      }
    }
  }

  // 寫檔
  try {
    fs.writeFileSync(REL_FILE, JSON.stringify(data, null, 2), 'utf8')
    console.log('[updateRelationshipWithLLM] relationship updated ->', REL_FILE)
  } catch (e) {
    console.error('[relationship] write REL_FILE failed:', REL_FILE, e)
  }
}

/**
 * 方便 server 一次呼 belief & relationship（你在 server 有呼叫 updateBeliefAndRelationshipWithLLM）
 */
export async function updateBeliefAndRelationshipWithLLM(latestMsg, flatHistory, REL_FILE, opts = {}) {
  try {
    await updateBeliefWithLLM(latestMsg, flatHistory, REL_FILE, opts.belief ?? {})
  } catch (e) {
    console.error('[pipeline] belief update failed:', e)
  }
  try {
    await updateRelationshipWithLLM(latestMsg, flatHistory, REL_FILE, opts.relationship ?? {})
  } catch (e) {
    console.error('[pipeline] relationship update failed:', e)
  }
}

// === 只給學生看的社會脈絡（belief + relationship）摘要 & 定義 ===
const REL_DEFAULT_FILE = 'src/stores/simulator/relationship_belief.json'

// ====== 區間定義：關係 (relationship) & 主題偏好 (belief/ideas) ======
// ==============================================
// relationship_belief for students (bucket-based)
// ==============================================

// ====== 區間定義：關係 (relationship) & 主題偏好 (belief/ideas) ======
export const REL_BUCKETS = [
  { key: 'hostile',    range: [-1.0, -0.7], label: '極度討厭',
    advise: '傾向冷淡或負面互動；避免主動回覆對方；如被點名，簡短回應並聚焦事實，不使用攻擊性語言。' },
  { key: 'dislike',    range: [-0.7, -0.4], label: '不喜歡',
    advise: '謹慎互動；避免衝突；如需回覆，採用中性語氣並把話題轉回任務。' },
  { key: 'uneasy',     range: [-0.4, -0.1], label: '不太合',
    advise: '保持專業距離；可簡短互動，但不延伸情緒；盡量轉給他人或回到議題。' },
  { key: 'neutral',    range: [-0.1,  0.1], label: '普通',
    advise: '一般互動；按照議題需求回覆，不刻意親近或疏遠。' },
  { key: 'friendly',   range: [ 0.1,  0.4], label: '友好',
    advise: '偏向回覆與支持；願意補充、協作與具體化對方想法。' },
  { key: 'ally',       range: [ 0.4,  0.7], label: '很合拍',
    advise: '主動接話、補充論據、幫忙釐清；在對方被質疑時給予建設性支持。' },
  { key: 'tight',      range: [ 0.7,  1.0], label: '高度信任',
    advise: '優先互動對象；積極協同、共同整合；必要時替對方翻譯/橋接他人。' },
]

export const BELIEF_BUCKETS = [
  { key: 'avoid',    range: [-1.0, -0.5], label: '強烈不偏好',
    advise: '若該主題出現，傾向提出理性保留或轉向更可行選項，不主動開啟該主題。' },
  { key: 'low',      range: [-0.5, -0.1], label: '不偏好',
    advise: '通常不主動；被問到時簡短且中立，避免拉長該話題。' },
  { key: 'neutral',  range: [-0.1,  0.1], label: '中立',
    advise: '按需要回應，無特別推進或阻止。' },
  { key: 'prefer',   range: [ 0.1,  0.5], label: '偏好',
    advise: '若語境合適，會主動回應與補充；傾向分享具體作法或正面案例。' },
  { key: 'strong',   range: [ 0.5,  1.0], label: '強烈偏好',
    advise: '優先關注與主動帶話題；提供實作步驟、把零散意見整合成可行方案。' },
]

// 依分數回傳所屬 bucket
export function scoreToBucket(score, buckets) {
  const s = Number(score)
  for (const b of buckets) {
    const [lo, hi] = b.range
    if (s >= lo && s < hi) return b
  }
  // 邊界 = 1.0 的情況
  const last = buckets[buckets.length - 1]
  if (s === last.range[1]) return last
  return null
}

// ====== 學生可讀的社會脈絡定義（不出現 Allies/Watch-out 用語） ======
export const SOCIAL_DEFINITION_FOR_STUDENT = `
【社會脈絡（僅供學生參考）】
- belief.ideas[idea]：你對某「想法/主題」的支持度，[-1,+1]；越高越支持，越會主動推進。
- relationship[你][同學]：你對某位同學的合作/好感傾向，[-1,+1]；越高越正向。
【行為規則】
1) 回覆誰、如何回：請依「你→對方」的關係分數區間決定互動強度與語氣。
2) 帶什麼主題：請依你對各 idea 的分數區間決定發言傾向；高分主題優先主動、提出具體步驟；低分主題避免主動，必要時中立簡短。
3) 如遇分歧：先對齊評估準則（時間、風險、成本、回饋方式），避免情緒化爭論，專注在可執行的方案。
`.trim()

// ====== 檔案載入 / 工具 ======
export function _loadRelBeliefStudent(file = REL_DEFAULT_FILE) {
  try {
    if (!fs.existsSync(file)) return { members: [] }
    const data = JSON.parse(fs.readFileSync(file, 'utf8') || '{"members":[]}')
    if (!data || !Array.isArray(data.members)) return { members: [] }
    for (const m of data.members) {
      m.name = String(m.name ?? '').trim()
      if (!m.belief || typeof m.belief !== 'object') m.belief = {}
      if (!m.belief.ideas || typeof m.belief.ideas !== 'object') m.belief.ideas = {}
      if (!m.relationship || typeof m.relationship !== 'object') m.relationship = {}
    }
    return data
  } catch {
    return { members: [] }
  }
}

export function _topK(obj = {}, k = 5, byAbs = true) {
  const arr = Object.entries(obj).map(([key, v]) => [key, Number(v)])
  const sorted = arr.sort((a, b) =>
    byAbs ? Math.abs(b[1]) - Math.abs(a[1]) : b[1] - a[1]
  )
  return sorted.slice(0, k)
}

// ====== 產生「只給該學生看的社會脈絡」：同儕與主題都用區間定義 ======
/**
 * @param {string} studentName
 * @param {object} opts { file?: string, maxPeers?: number, maxIdeas?: number }
 * @returns {string} 一段可直接塞進學生 prompt 的文字塊
 */
export function buildStudentSocialBlock(studentName, { file = REL_DEFAULT_FILE, maxPeers = 8, maxIdeas = 8 } = {}) {
  const data = _loadRelBeliefStudent(file)
  const me = (data.members || []).find(m => m.name === studentName)
  if (!me) return '(目前找不到你的社會脈絡資料)'

  // 同儕（依絕對值大到小，擷取前 maxPeers）
  const peersSorted = Object.entries(me.relationship || {})
    .filter(([name]) => name && name !== 'Host')
    .map(([name, sc]) => ({ name, score: Number(sc) }))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, maxPeers)

  const peerLines = peersSorted.map(p => {
    const b = scoreToBucket(p.score, REL_BUCKETS)
    return `- 你對【${p.name}】：${p.score.toFixed(2)}（${b?.label ?? '未定義'}）。互動建議：${b?.advise ?? '一般互動。'}`
  }).join('\n')

  // 主題（依絕對值大到小，擷取前 maxIdeas）
  const ideasSorted = Object.entries(me.belief?.ideas || {})
    .map(([idea, sc]) => ({ idea, score: Number(sc) }))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, maxIdeas)

  const ideaLines = ideasSorted.map(i => {
    const b = scoreToBucket(i.score, BELIEF_BUCKETS)
    return `- 主題【${i.idea}】：${i.score.toFixed(2)}（${b?.label ?? '未定義'}）。發言傾向：${b?.advise ?? '中立回應。'}`
  }).join('\n')

  // 全班 idea 風向（平均值，僅供參考，不帶 Allies/Watch-out）
  const ideaSum = {}, ideaCnt = {}
  for (const m of data.members || []) {
    if (!m?.name || m.name === 'Host') continue
    for (const [idea, v] of Object.entries(m.belief?.ideas || {})) {
      ideaSum[idea] = (ideaSum[idea] ?? 0) + Number(v)
      ideaCnt[idea] = (ideaCnt[idea] ?? 0) + 1
    }
  }
  const ideaAvgEntries = Object.keys(ideaSum).map(k => [k, ideaSum[k] / (ideaCnt[k] || 1)])
  const topAvg = ideaAvgEntries
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5)
    .map(([k, v]) => `${k}:${v.toFixed(2)}`)
    .join('，') || '（無）'

  return `
[社會脈絡規則 — 僅適用於你（學生）]
請依下列分數區間對應的行為，不要隨機決定喜好或臨時產生主題偏好。

【關係分數 → 互動行為】
${REL_BUCKETS.map(b => `- ${b.range[0]} ~ ${b.range[1]}：${b.label} → ${b.advise}`).join('\n')}

【主題分數 → 發言偏好】
${BELIEF_BUCKETS.map(b => `- ${b.range[0]} ~ ${b.range[1]}：${b.label} → ${b.advise}`).join('\n')}

【你目前對同儕的關係狀態（依影響度排序，最多 ${maxPeers} 位）】
${peerLines || '（暫無資料）'}

【你目前對主題的偏好狀態（依影響度排序，最多 ${maxIdeas} 個）】
${ideaLines || '（暫無資料）'}

【全班主題風向（平均，僅供參考）】
${topAvg}
`.trim()
}

// ====== 學生 prompt logger ======
function _sanitizeFilePart(s) {
  return String(s || '')
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .slice(0, 80)
}

/**
 * 將學生 prompt 追加寫入 log。
 * - baseFile: 總表
 * - perStudent: 是否另外各寫一份到 src/stores/simulator/prompts/<name>.log
 */
export function appendStudentPromptLog({
  name,
  prompt,
  stateDiagram,
  baseFile = 'src/stores/simulator/student_prompts.log',
  perStudent = true
}) {
  try {
    const ts = new Date().toISOString()
    const node = stateDiagram?.currentNode ?? '(unknown)'
    const small = stateDiagram?.currentNodeSmall ?? '(unknown)'

    const header = [
      `\n===== ${ts} =====`,
      `Student: ${name}`,
      `Node: ${node}  Small: ${small}`
    ].join('\n')

    // 總表
    fs.appendFileSync(baseFile, `${header}\nPROMPT:\n${prompt}\n`, 'utf8')

    // 每位學生各自獨立檔（可選）
    if (perStudent) {
      const pName = _sanitizeFilePart(name)
      const perFile = `src/stores/simulator/prompts/${pName}.log`
      fs.mkdirSync('src/stores/simulator/prompts', { recursive: true })
      fs.appendFileSync(perFile, `${header}\nPROMPT:\n${prompt}\n`, 'utf8')
    }

    console.log(`[student-prompt] wrote for ${name} @ node=${node}/${small}`)
  } catch (e) {
    console.warn('[student-prompt] append fail:', e.message)
  }
}
