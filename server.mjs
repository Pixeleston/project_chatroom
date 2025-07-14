import { WebSocketServer } from 'ws'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/* 取得等同於 CommonJS 的 __dirname */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/* ────────────────────────────── 基本設定 */

const PORT = 3000
const HISTORY_FILE = path.join(__dirname, 'public/history.json')
const MEMORY_FILE = path.join(__dirname, 'public/memory.json')
const FLOW_FILE = path.join(__dirname, 'public/flow.json')
const MEMORY_MODE = 'last_10'

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

app.listen(PORT, () => {
  console.log(`HTTP API listening on http://localhost:${PORT}`)
})

/* ────────────────────────────── WebSocket Server */

const wss = new WebSocketServer({ port: PORT + 1 })

let history = []
let hostMemory = []

const headerPrompt = [
  `你是這個聊天室的主持人，要用繁體中文與使用者互動。
  - 回應要友善、親切、有鼓勵性
  - 不要一次說太多話，請保持回覆簡短，少於100字
  - 如果使用者不清楚問題，可以請他說得更清楚
  - 每次請只說一句話或一個想法即可，不要長篇大論`
]

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

const writeJson = (file, data) =>
  fs.writeFile(file, JSON.stringify(data, null, 2), err =>
    err && console.error(`Failed to save ${file}:`, err))

function saveHistory() { writeJson(HISTORY_FILE, history) }
function saveMemory() { writeJson(MEMORY_FILE, hostMemory) }

function updateMemory() {
  if (MEMORY_MODE === 'last_10') {
    hostMemory = history
      .filter(msg => msg.user !== 'Host')
      .slice(-10)
      .map(msg => `${msg.user}: ${msg.text}`)
    saveMemory()
  }
}

const broadcast = packet =>
  wss.clients.forEach(c =>
    c.readyState === c.OPEN && c.send(JSON.stringify(packet)))

const makePrompt = ({ user, text }) => [
  ...headerPrompt,
  '\n以下是歷史對話：',
  hostMemory.join('\n'),
  '\n歷史對話結束，請根據以下使用者的最新訊息回覆：\n',
  `${user}: ${text}`
].join('\n')

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'history', data: history }))

  ws.on('message', async raw => {
    try {
      const data = JSON.parse(raw)
      history.push(data)
      saveHistory()
      updateMemory()

      broadcast({ type: 'message', data })

      if (data.user !== 'Host') {
        const prompt = makePrompt(data)
        console.log('\n===== Prompt to LLM =====\n', prompt, '\n=========================')

        let reply = '(預設回覆)'
        try {
          const res = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "qwen:32b", prompt, stream: false })
          })

          if (res.ok) {
            const result = await res.json()
            if (result && result.response) reply = result.response.trim()
          } else {
            console.error(`LLM response not ok: ${res.status}`)
          }
        } catch (err) {
          console.error('LLM fetch failed:', err.message)
        }

        hostMemory.push(`Host: ${reply}`)
        const replyMsg = { user: 'Host', text: reply }

        history.push(replyMsg)
        saveHistory()
        updateMemory()

        broadcast({ type: 'message', data: replyMsg })
      }
    } catch (err) {
      console.error('Invalid message or LLM error:', err)
    }
  })
})
