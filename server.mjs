import { WebSocketServer } from 'ws'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { callLLM } from './callLLM.js'
import { LLM_CONFIG } from './config.js'
import { getNextNode } from './stateMachine.js'
import { teacher_action } from './teacher.js'


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
    const settings = { LLM_TOGGLE: Boolean(LLM_TOGGLE) }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
    res.json({ success: true, LLM_TOGGLE: settings.LLM_TOGGLE })
  } catch (err) {
    res.status(500).json({ error: '寫入設定檔失敗' })
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
loadJson(MEMORY_FILE, hostMemory, 'memory')

const writeJson = (file, data) => {
  console.log(data);
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

function saveHistory() { writeJson(HISTORY_FILE, history) }
function saveMemory(memory_dir) { writeJson(memory_dir, hostMemory) }
function saveDiagram(diagram) { writeJson(STATE_DIAGRAM_FILE, diagram) }

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

let memory_string = ""
if(LLM_CONFIG.custom_memory) 
  memory_string = `\n以下是歷史對話：${hostMemory.join('\n')}\n歷史對話結束，請根據以下使用者的最新訊息回覆：\n`

function sendMessage(replyMsg){
  messageCount ++;
  //const replyMsg = { user: 'Host', text: replyText };
  history.push(replyMsg);
  saveHistory();

  if(messageCount >= MESSAGES_COUNT_PER_UPDATE_MEMORY){
    updateMemory(MEMORY_FILE);
    messageCount = 0;
  }
  
  broadcast({ type: 'message', data: replyMsg });
}

async function decide_small_part(){

}

async function tick_chatroom() {
  const { LLM_TOGGLE } = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
  if(LLM_TOGGLE){
    try {
      const stateDiagram = JSON.parse(fs.readFileSync(STATE_DIAGRAM_FILE, 'utf8') || '{}')

      const { replyMsg, stateDiagram: newStateDiagram, broadcastPayload } = await teacher_action(stateDiagram, hostMemory)

      if(replyMsg) sendMessage(replyMsg);
      saveDiagram(newStateDiagram)
      if(broadcastPayload) broadcast(broadcastPayload);

    } catch (err) {
      console.error('tick() failed:', err)
    }
  }
}
setInterval(tick_chatroom, 10000)  // 每 10 秒執行一次

async function tick_simulator() {
    
}

setInterval(tick_simulator, 5000)  // 每 10 秒執行一次

// 有新訊息
wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'history', data: history }))

  ws.on('message', async raw => {
    try {
      const data = JSON.parse(raw)
      if (data.user !== 'Host') {
        sendMessage(data)
      }
    } catch (err) {
      console.error('Invalid message or LLM error:', err)
    }
  })
})