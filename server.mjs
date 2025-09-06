import { WebSocketServer } from 'ws'
import WebSocket from 'ws'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { teacher_action } from './teacher.js'
import { student_action } from './student.js'
import { prompt_spawn_example, filterHistory, prompt_spawn_student } from './src/prompt.js'
import { callLLM } from './src/callLLM.js'

// TODO diagram 每次使用都直接拿currentDiagram，儲存時存入currentDiagram，可以檢查看看讀取時是否會讀到舊的資料


/* 取得等同於 CommonJS 的 __dirname */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/* ────────────────────────────── 基本設定 */

const PORT = 3000
const HISTORY_FILE = path.join(__dirname, 'src/stores/history.json')
const MEMORY_FILE = path.join(__dirname, 'src/stores/memory.json')
const FLOW_FILE = path.join(__dirname, 'src/stores/flow.json')
const SETTINGS_FILE = path.join(__dirname, 'src/stores/settings.json')
const STATE_DIAGRAM_FILE = path.join(__dirname, 'src/stores/state_diagram.json')
const MEMORY_MODE = 'last_10'

const HISTORY_SIMULATOR_FILE = path.join(__dirname, 'src/stores/simulator/history.json')
const MEMORY_SIMULATOR_FILE = path.join(__dirname, 'src/stores/simulator/memory.json')
const STATE_DIAGRAM_SIMULATOR_FILE = path.join(__dirname, 'src/stores/simulator/state_diagram.json')
const STUDENT_PROFILE_SIMULATOR_FILE = path.join(__dirname, 'src/stores/simulator/student_profile.json')

const MESSAGES_COUNT_PER_UPDATE_MEMORY = 10;

/* ────────────────────────────── HTTP API 設定 */

const app = express()
app.use(cors())
app.use(express.json())


app.get('/api/state', (req, res) => {
  fs.readFile(FLOW_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'flow.json 讀取失敗' })
    res.json(JSON.parse(data || '{}'))
  })
})

app.post('/api/state', (req, res) => {
  fs.writeFile(FLOW_FILE, JSON.stringify(req.body, null, 2), err => {
    if (err) return res.status(500).json({ error: 'flow.json 寫入失敗' })
    res.json({ message: 'flow.json 已儲存' })
  })
})

app.get('/api/diagram', (req, res) => {
  fs.readFile(STATE_DIAGRAM_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'state_diagram 讀取失敗' })
    console.log("state_diagram 讀取成功")
    res.json(JSON.parse(data || '{}'))
  })
})

/* save diagram */
app.post('/api/diagram', (req, res) => {
  fs.writeFile(STATE_DIAGRAM_FILE, JSON.stringify(req.body, null, 2), err => {
    if (err) return res.status(500).json({ error: 'state_diagram 寫入失敗' })
    res.json({ message: 'state_diagram 已儲存' })
  })
})

app.get('/api/diagramSimulator', (req, res) => {
  fs.readFile(STATE_DIAGRAM_SIMULATOR_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'state_diagram_simulator 讀取失敗' })
    console.log("state_diagram_simulator 讀取成功")
    res.json(JSON.parse(data || '{}'))
  })
})

app.post('/api/diagramSimulator', (req, res) => {
  fs.writeFile(STATE_DIAGRAM_SIMULATOR_FILE, JSON.stringify(req.body, null, 2), err => {
    if (err) return res.status(500).json({ error: 'state_diagram_simulator 寫入失敗' })
    res.json({ message: 'state_diagram_simulator 已儲存' })
  })
})

app.get('/api/LLM_TOGGLE', (req, res) => {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
    console.log("settings.:LLM_TOGGLE is " + settings.LLM_TOGGLE)
    res.json({ LLM_TOGGLE: settings.LLM_TOGGLE })
  } catch (err) {
    res.status(500).json({ error: '讀取設定檔失敗' })
  }
})

app.post('/api/LLM_TOGGLE', (req, res) => {
  try {
    const { LLM_TOGGLE } = req.body
    let settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
    settings.LLM_TOGGLE = Boolean(LLM_TOGGLE) 
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
    res.json({ success: true, LLM_TOGGLE: settings.LLM_TOGGLE })
  } catch (err) {
    res.status(500).json({ error: '寫入設定檔失敗' })
  }
})

app.get('/api/SIMULATOR_TOGGLE', (req, res) => {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
    console.log("settings.:RUN_TOGGLE_SIMULATOR is " + settings.RUN_TOGGLE_SIMULATOR)
    res.json({ RUN_TOGGLE_SIMULATOR: settings.RUN_TOGGLE_SIMULATOR })
  } catch (err) {
    res.status(500).json({ error: '讀取設定檔失敗' })
  }
})

app.post('/api/SIMULATOR_TOGGLE_OPEN', (req, res) => {
  try {
    const { RUN_TOGGLE_SIMULATOR } = req.body
    let settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
    settings.RUN_TOGGLE_SIMULATOR = true
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
    res.json({ success: true, RUN_TOGGLE_SIMULATOR: settings.RUN_TOGGLE_SIMULATOR })
  } catch (err) {
    res.status(500).json({ error: '寫入設定檔失敗' })
  }
})

app.post('/api/SIMULATOR_TOGGLE_CLOSE', (req, res) => {
  try {
    const { RUN_TOGGLE_SIMULATOR } = req.body
    let settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
    settings.RUN_TOGGLE_SIMULATOR = false
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
    res.json({ success: true, RUN_TOGGLE_SIMULATOR: settings.RUN_TOGGLE_SIMULATOR })
  } catch (err) {
    res.status(500).json({ error: '寫入設定檔失敗' })
  }
})

app.post('/api/chatroom_ask_spawn', async (req, res) => {
  try {
    const { selectedNode, newMessage } = req.body
    const prompt = prompt_spawn_example(selectedNode, newMessage)
    console.log(`prompt: ${prompt}`)
    const response = await callLLM('gpt-4o', prompt)
    console.log(`get result: ${response}`)
    res.json({ result: response })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// spawn student's description
app.post('/api/spawnStudent', async (req, res) => {
  try {
    const { metrics } = req.body
    const prompt = prompt_spawn_student(JSON.stringify(metrics))
    const llmReply = await callLLM('gpt-4o', prompt)
    res.json({ reply: llmReply })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// add spawned student to simulator
app.post('/api/addStudent', async (req, res) => {
  try {
    const { name, profile } = req.body
    if (!name || !profile) {
      return res.status(400).json({ success: false, error: '缺少 name 或 profile' })
    }

    const data = fs.existsSync(STUDENT_PROFILE_SIMULATOR_FILE)
      ? JSON.parse(fs.readFileSync(STUDENT_PROFILE_SIMULATOR_FILE, 'utf8') || '[]')
      : []

    const alreadyExists = data.some(student => student.name === name)
    if (alreadyExists) {
      return res.status(200).json({ success: false, error: `學生名稱 "${name}" 已存在` })
    }

    data.push({ name, profile })

    fs.writeFileSync(STUDENT_PROFILE_SIMULATOR_FILE, JSON.stringify(data, null, 2))

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/getStudent', async (req, res) => {
  fs.readFile(STUDENT_PROFILE_SIMULATOR_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'student_profile_simulator 讀取失敗' })
    console.log("student_profile_simulator 讀取成功")
    res.json(JSON.parse(data || '{}'))
  })
})

app.post('/api/restartSimulator', async (req, res) => {
  try {
    historySimulator = []
    saveHistory("Simulator")
    currentDiagramSimulator.currentNodeSmall = "null"
    currentDiagramSimulator.currentNode = "start"
    currentDiagramSimulator.memory.nodesMemory = []
    saveDiagram(currentDiagramSimulator, "simulator")
    
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`HTTP API listening on http://localhost:${PORT}`)
})

/* ────────────────────────────── WebSocket Server */

const wss = new WebSocketServer({ port: PORT + 1 })

let history = []
let hostMemory = []
let messageCount = 0
let currentDiagram

let historySimulator = []
let hostMemorySimulator = []
let messageCountSimulator = 0
let currentDiagramSimulator
let student_profile

function loadJson(file, targetArr, label) {
  if (fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file, 'utf8')
      targetArr.splice(0, targetArr.length, ...JSON.parse(raw))
      console.log(`Loaded ${targetArr.length} ${label} from ${path.basename(file)}`)
    } catch (err) {
      console.error(`Failed to load ${label}:`, err)
    }
  }
}

loadJson(HISTORY_FILE, history, 'messages')
//loadJson(MEMORY_FILE, hostMemory, 'memory')
currentDiagram = JSON.parse(fs.readFileSync(STATE_DIAGRAM_FILE, 'utf8') || '{}')
student_profile = JSON.parse(fs.readFileSync(STUDENT_PROFILE_SIMULATOR_FILE, 'utf8') || '{}')

const writeJson = (file, data) => {
  try {
    const json = JSON.stringify(data, null, 2)
    fs.writeFile(file, json, err => {
      if (err) console.error(`Failed to save ${file}:`, err)
      else console.log(`Saved ${file} successfully`)
    })
  } catch (err) {
    console.error(`❌ JSON stringify failed for ${file}:`, err)
  }
}


function broadcastDiagramUpdate(newDiagram, chatroom_type) {
  const message = JSON.stringify({
    type: 'diagramUpdated',
    chatroom_type: chatroom_type,
    diagram: newDiagram
  })

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

function saveHistory(chatroom_type) {
  if (chatroom_type === "chatroom") writeJson(HISTORY_FILE, history)
  else writeJson(HISTORY_SIMULATOR_FILE, historySimulator)
}
function saveMemory(memory_dir) { writeJson(memory_dir, hostMemory) }
function saveDiagram(diagram, chatroom_type) {
  if(chatroom_type === "chatroom"){
    writeJson(STATE_DIAGRAM_FILE, diagram)
    currentDiagram = diagram
  }
  else {
    writeJson(STATE_DIAGRAM_SIMULATOR_FILE, diagram)
    currentDiagramSimulator = diagram
  }
  broadcastDiagramUpdate(diagram, chatroom_type)
}

function updateMemory(memory_dir) {
  hostMemory = history
    //.filter(msg => msg.user !== 'Host')
    .slice(-15)
    .map(msg => `${msg.user}: ${msg.text}`)
  saveMemory(memory_dir)
}

const broadcast = packet =>
  wss.clients.forEach(c =>
    c.readyState === c.OPEN && c.send(JSON.stringify(packet)))

function sendMessage(diagram, replyMsg, chatroom_type) {  // chatroom_type = "chatroom" or "simulator"
  //  messageCount ++;
  //const replyMsg = { user: 'Host', text: replyText };
  let id = (chatroom_type === 'chatroom') ? diagram.currentNode : currentDiagramSimulator.currentNode
  let small_id = (chatroom_type === 'chatroom') ? diagram.currentNodeSmall : currentDiagramSimulator.currentNodeSmall

  let _ = (chatroom_type === 'chatroom') ? history : historySimulator
  const node = _.find(n => n.id === id && n.small_id === small_id)

  if (node) {
    node.history.push(replyMsg);
  }
  else {
    if (chatroom_type === 'chatroom') {
      history.push(
        {
          id: id,
          small_id: small_id,
          history: [replyMsg]
        }
      )
    }
    else {
      historySimulator.push(
        {
          id: id,
          small_id: small_id,
          history: [replyMsg]
        }
      )
    }
  }
  saveHistory(chatroom_type);

  //if(messageCount >= MESSAGES_COUNT_PER_UPDATE_MEMORY){
  //  updateMemory(MEMORY_FILE);
  //  messageCount = 0;
  //}

  broadcast({ chatroom_type:chatroom_type, type: 'message', data: replyMsg });
}

async function tick_chatroom() {
  const { LLM_TOGGLE } = (JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')))
  if (LLM_TOGGLE) {
    try {
      //  const stateDiagram = JSON.parse(fs.readFileSync(STATE_DIAGRAM_FILE, 'utf8') || '{}')
      let currentHistory = filterHistory(currentDiagram, history)
      const { replyMsg, stateDiagram: newStateDiagram, moveNode } = await teacher_action(currentDiagram, currentHistory.slice(-15).map(msg => `${msg.user}: ${msg.text}`))

      if (replyMsg && replyMsg !== 'null') sendMessage(currentDiagram, replyMsg, "chatroom");  // TODO 可能需要改，因為會有轉移節點前或後發話的問題
      if (moveNode) {
        // move node
        if (moveNode.nextNode === "big") newStateDiagram.currentNode = moveNode.nextNodeID;
        else if (moveNode.nextNode === "small") newStateDiagram.currentNodeSmall = moveNode.nextNodeID;
      }
      saveDiagram(newStateDiagram, "chatroom")
    } catch (err) {
      console.error('tick() failed:', err)
    }
  }
}
setInterval(tick_chatroom, 10000)  // 每 10 秒執行一次



loadJson(HISTORY_SIMULATOR_FILE, historySimulator, 'messages')
currentDiagramSimulator = JSON.parse(fs.readFileSync(STATE_DIAGRAM_SIMULATOR_FILE, 'utf8') || '{}')


async function tick_simulator() {
  const { RUN_TOGGLE_SIMULATOR } = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
  if (RUN_TOGGLE_SIMULATOR) {
    let currentHistory = filterHistory(currentDiagramSimulator, historySimulator).map(msg => `${msg.user}: ${msg.text}`)
    console.log(currentHistory)
    // For students
    const tasks = student_profile.map(student =>
      student_action(currentDiagramSimulator, currentHistory, student.profile)
    )

    const results = await Promise.all(tasks)

    // For host
    try {
      //  const stateDiagram = JSON.parse(fs.readFileSync(STATE_DIAGRAM_FILE, 'utf8') || '{}')
      console.log(currentHistory)
      const { replyMsg, stateDiagram: newStateDiagram, moveNode } = await teacher_action(currentDiagramSimulator, currentHistory.slice(-15).map(msg => `${msg.user}: ${msg.text}`))

      if (replyMsg && replyMsg !== 'null') sendMessage(currentDiagram, replyMsg, "simulator");
      if (moveNode) {
        // move node
        if (moveNode.nextNode === "big") newStateDiagram.currentNode = moveNode.nextNodeID;
        else if (moveNode.nextNode === "small") newStateDiagram.currentNodeSmall = moveNode.nextNodeID;
      }
      saveDiagram(newStateDiagram, "simulator")
    } catch (err) {
      console.error('tick() failed:', err)
    }
  }
}

setInterval(tick_simulator, 15000)

// 有新訊息
wss.on('connection', ws => {
  ws.send(JSON.stringify({ chatroom_type: 'chatroom', type: 'history', data: history }))
  ws.send(JSON.stringify({ chatroom_type: 'simulator', type: 'history', data: historySimulator }))

  ws.on('message', async raw => {
    try {
      //const stateDiagram = JSON.parse(fs.readFileSync(STATE_DIAGRAM_FILE, 'utf8') || '{}')
      const data = JSON.parse(raw)
      const { chatroom_type, msg_data } = data
      if (msg_data.role !== 'host') {
        sendMessage(currentDiagram, msg_data, chatroom_type)
      }
    } catch (err) {
      console.error('Invalid message or LLM error:', err)
    }
  })
})