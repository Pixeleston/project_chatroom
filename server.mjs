import { WebSocketServer } from 'ws'
import WebSocket from 'ws'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { teacher_action } from './teacher.js'
import { student_action } from './student.js'
import { prompt_spawn_example, filterHistory, prompt_spawn_student, prompt_spawn_report, prompt_ask_improve, rebuildRelationshipBeliefFromNames,
  updateRelationshipBeliefOnNewStudentData, updateBeliefWithLLM, updateRelationshipWithLLM} from './src/prompt.js'
import { callLLM } from './src/callLLM.js'
import { spawnDiagram } from './spawnDiagram.js'
import { DEBUG_CONFIG, SIMULATOR_CONFIG } from './src/config.js'

/* 取得等同於 CommonJS 的 __dirname */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/* ────────────────────────────── 基本設定 */
const PORT = 3000
// ... (其他路徑常數不變) ...
const HISTORY_FILE = path.join(__dirname, 'src/stores/history.json')
const MEMORY_FILE = path.join(__dirname, 'src/stores/memory.json')
const FLOW_FILE = path.join(__dirname, 'src/stores/flow.json')
const SETTINGS_FILE = path.join(__dirname, 'src/stores/settings.json')
const STATE_DIAGRAM_FILE = path.join(__dirname, 'src/stores/state_diagram.json')
const HISTORY_SIMULATOR_FILE = path.join(__dirname, 'src/stores/simulator/history.json')
const STATE_DIAGRAM_SIMULATOR_FILE = path.join(__dirname, 'src/stores/simulator/state_diagram.json')
const STATE_DIAGRAM_IMPROVE_FILE = path.join(__dirname, 'src/stores/improve/state_diagram.json')
const STUDENT_PROFILE_SIMULATOR_FILE = path.join(__dirname, 'src/stores/simulator/student_profile.json')
const REPORT_IMPROVE_FILE = path.join(__dirname, 'src/stores/improve/report.json')
const RELATIONSHIP_BELIEF_FILE = path.join(__dirname, 'src/stores/simulator/relationship_belief.json');

const INITIAL_SIMULATOR_TOPICS = ['AI應用', '資料庫設計', '前端框架', '專案時程', '使用者體驗', '商業模式'];

/* ────────────────────────────── HTTP API 設定 */
const app = express()
app.use(cors())
app.use(express.json())

// ... (所有 API 端點的程式碼都維持原樣，此處省略以保持簡潔) ...
// ... app.get, app.post ...
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
    currentDiagram = req.body
    history = []
    saveHistory("chatroom")
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
  
  app.get('/api/diagramImprove', (req, res) => {
    fs.readFile(STATE_DIAGRAM_IMPROVE_FILE, 'utf8', (err, data) => {
      if (err) return res.status(500).json({ error: 'state_diagram_improve 讀取失敗' })
      console.log("state_diagram_improve 讀取成功")
      res.json(JSON.parse(data || '{}'))
    })
  })
  
  app.post('/api/diagramImprove', (req, res) => {
    fs.writeFile(STATE_DIAGRAM_IMPROVE_FILE, JSON.stringify(req.body, null, 2), err => {
      if (err) return res.status(500).json({ error: 'state_diagram_improve 寫入失敗' })
      res.json({ message: 'state_diagram_improve 已儲存' })
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
  
  function SIMULATOR_TOGGLE_CLOSE(){
    try {
      let settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
      settings.RUN_TOGGLE_SIMULATOR = false
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
    }
    catch (err){

    }
  }
  
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
      const response = await callLLM('gpt-4o', prompt, "[/api/chatroom_ask_spawn]")
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
      let llmReply = await callLLM('gpt-4o', prompt, "[/api/spawnStudent]")
      llmReply = (llmReply || '').replace(/<END>/g, '').trim()
      res.json({ reply: llmReply })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
  
  function ensureDirFor(filePath) {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
  
  app.post('/api/addStudent', async (req, res) => {
    try {
      const { name, profile } = req.body;
      if (!name || !profile) {
        return res.status(400).json({ success: false, error: '缺少 name 或 profile' });
      }
      const data = fs.existsSync(STUDENT_PROFILE_SIMULATOR_FILE)
        ? JSON.parse(fs.readFileSync(STUDENT_PROFILE_SIMULATOR_FILE, 'utf8') || '[]')
        : [];
  
      if (data.some(student => student.name === name)) {
        return res.status(200).json({ success: false, error: `學生名稱 "${name}" 已存在` });
      }
  
      data.push({ name, profile });
      fs.writeFileSync(STUDENT_PROFILE_SIMULATOR_FILE, JSON.stringify(data, null, 2), 'utf8');
      student_profile = data;  // 若在模擬前臨時增加學生，記得同步更新模擬學生列表
  
      const names = data.map(s => s.name);
      const relData = fs.existsSync(RELATIONSHIP_BELIEF_FILE)
        ? JSON.parse(fs.readFileSync(RELATIONSHIP_BELIEF_FILE, 'utf8') || '{"members":[]}')
        : { members: [] };
  
      const updated = updateRelationshipBeliefOnNewStudentData(
        relData, names, name,
        {
          seed: Date.now(),
          symmetric: false,
          relMin: -0.8,
          relMax: 0.9,
          initialIdeas: INITIAL_SIMULATOR_TOPICS
        }
      );
  
      ensureDirFor(RELATIONSHIP_BELIEF_FILE);
      fs.writeFileSync(RELATIONSHIP_BELIEF_FILE, JSON.stringify(updated, null, 2), 'utf8');
      console.log('[addStudent] relationship_belief updated for new student:', name);
      res.json({ success: true });
    } catch (err) {
      console.error('[addStudent] error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  
  app.get('/api/getStudent', async (req, res) => {
    fs.readFile(STUDENT_PROFILE_SIMULATOR_FILE, 'utf8', (err, data) => {
      if (err) return res.status(500).json({ error: 'student_profile_simulator 讀取失敗' });
      res.json(JSON.parse(data || '[]'));
    });
  });
  
  app.post('/api/setStudent', async (req, res) => {
    try {
      const newStudent = req.body;
      fs.writeFileSync(STUDENT_PROFILE_SIMULATOR_FILE, JSON.stringify(newStudent, null, 2), 'utf8');
  
      const names = (Array.isArray(newStudent) ? newStudent : []).map(s => s?.name).filter(Boolean);
  
      const rebuilt = rebuildRelationshipBeliefFromNames(
        names,
        {
          seed: Date.now(),
          symmetric: false,
          relMin: -0.8,
          relMax: 0.9,
          initialIdeas: INITIAL_SIMULATOR_TOPICS
        }
      );
  
      ensureDirFor(RELATIONSHIP_BELIEF_FILE);
      fs.writeFileSync(RELATIONSHIP_BELIEF_FILE, JSON.stringify(rebuilt, null, 2), 'utf8');
      console.log('[setStudent] relationship_belief rebuilt. members:', names.length);
      res.json({ success: true });
    } catch (err) {
      console.error('[setStudent] error:', err);
      res.status(500).json({ error: '設定學生失敗' });
    }
  });
  
  app.post('/api/spawnReport', async (req, res) => {
    try {
      const prompt = prompt_spawn_report(currentDiagramSimulator)
      const llmReply = await callLLM('gpt-4o', prompt, "[/api/spawnReport]")
  
      const reportData = {
        report_text: llmReply,
        state_diagram: currentDiagramSimulator
      }
  
      fs.writeFileSync(REPORT_IMPROVE_FILE, JSON.stringify(reportData, null, 2), 'utf-8')
      res.json(reportData)
  
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
  
  app.post('/api/chatroom_ask_improve', async (req, res) => {
    try {
      const { state_diagram, history } = req.body
      const prompt = prompt_ask_improve(state_diagram, history)
      const rawResponse = await callLLM('gpt-4o', prompt, "[/api/chatroom_ask_improve]")
      const result = rawResponse.slice(rawResponse.indexOf('{'), rawResponse.lastIndexOf('}') + 1)
      const parsed = JSON.parse(result)
      res.json({ result: parsed })
    } catch (err) {
      console.error('❌ JSON 解析失敗:', err)
      res.status(500).json({ error: 'LLM 回傳格式錯誤：' + err.message })
    }
  })
  
  app.post('/api/spawn_diagram', async (req, res) => {
    try {
      const { outline } = req.body
      const { nodeArray, detailArray } = await spawnDiagram(outline)
      res.json({ nodeArray: nodeArray, detailArray: detailArray })
    } catch (err) {
      console.error('❌ JSON 解析失敗:', err)
      res.status(500).json({ error: 'LLM 回傳格式錯誤：' + err.message })
    }
  })
  
  app.post('/api/callLLM', async (req, res) => {
    try {
      const { prompt } = req.body
      const rawResponse = await callLLM('gpt-4o', prompt, "/api/callLLM")
      res.json({ result: rawResponse })
    } catch (err) {
      console.error('❌ LLM 呼叫失敗:', err)
      res.status(500).json({ error: 'LLM 回傳格式錯誤：' + err.message })
    }
  })
  
  app.get('/api/getReport', async (req, res) => {
    fs.readFile(REPORT_IMPROVE_FILE, 'utf8', (err, data) => {
      if (err) return res.status(500).json({ error: 'report 讀取失敗' })
      res.json(JSON.parse(data || '{}'))
    })
  })
  
  app.post('/api/setReport', async (req, res) => {
    try {
      const reportData = req.body
      fs.writeFileSync(REPORT_IMPROVE_FILE, JSON.stringify(reportData, null, 2), 'utf-8')
      res.json(reportData)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
  
  app.post('/api/restartSimulator', async (req, res) => {
    try {
      // 1. 重置對話紀錄
      historySimulator = [];
      saveHistory("Simulator");

      // 2. 重置狀態圖的進度
      if (currentDiagramSimulator) {
          currentDiagramSimulator.currentNodeSmall = "null";
          currentDiagramSimulator.currentNode = "start";
          currentDiagramSimulator.memory.nodesMemory = [];
          currentDiagramSimulator.voting = false;
          currentDiagramSimulator.voting_array = []
          saveDiagram(currentDiagramSimulator, "simulator");
      }

      // ==========================================================
      // [核心修正] 重新初始化 relationship 並清空 belief
      // ==========================================================
      console.log('[Restart Simulator] Re-initializing relationship and clearing belief data...');

      // 從硬碟重新讀取最新的學生檔案，確保拿到最新名單
      const current_student_profile = JSON.parse(fs.readFileSync(STUDENT_PROFILE_SIMULATOR_FILE, 'utf8') || '[]');
      student_profile = current_student_profile; // 同步更新記憶體中的變數
      
      const studentNames = current_student_profile.map(s => s.name);

      if (studentNames.length > 0) {
          const reinitializedData = rebuildRelationshipBeliefFromNames(
              studentNames,
              {
                  seed: Date.now(),
                  symmetric: false,
                  relMin: -1.0,
                  relMax: 1.0,
                  // ★★★ 關鍵修改：傳入空陣列，這樣 belief.ideas 就會是空的 {} ★★★
                  initialIdeas: [] 
              }
          );
          
          // 覆寫舊檔案
          ensureDirFor(RELATIONSHIP_BELIEF_FILE);
          fs.writeFileSync(RELATIONSHIP_BELIEF_FILE, JSON.stringify(reinitializedData, null, 2), 'utf8');
          console.log(`[Restart Simulator] Successfully re-initialized relationships and cleared beliefs for ${studentNames.length} students.`);
      } else {
          // 如果沒有學生，一樣寫入空的檔案
          fs.writeFileSync(RELATIONSHIP_BELIEF_FILE, JSON.stringify({ members: [] }, null, 2), 'utf8');
          console.log('[Restart Simulator] No students found. Wrote empty relationship_belief.json.');
      }
      // ==========================================================

      res.json({ success: true });
    } catch (err) {
      console.error('[Restart Simulator] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

app.listen(PORT, () => {
  console.log(`HTTP API listening on http://localhost:${PORT}`)
})

/* ────────────────────────────── WebSocket Server & Data Loading */
const wss = new WebSocketServer({ port: PORT + 1 })

let history = []
let currentDiagram
let historySimulator = []
let currentDiagramSimulator
let student_profile = []

function loadJson(file, defaultVal = []) {
  if (fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file, 'utf8')
      return JSON.parse(raw);
    } catch (err) {
      console.error(`Failed to load or parse ${path.basename(file)}:`, err)
      return defaultVal;
    }
  }
  return defaultVal;
}

history = loadJson(HISTORY_FILE, [])
currentDiagram = loadJson(STATE_DIAGRAM_FILE, {})
student_profile = loadJson(STUDENT_PROFILE_SIMULATOR_FILE, [])
historySimulator = loadJson(HISTORY_SIMULATOR_FILE, [])
currentDiagramSimulator = loadJson(STATE_DIAGRAM_SIMULATOR_FILE, {})


// =================================================================
// [新增] 伺服器啟動時的 Belief 初始化檢查與修復
// =================================================================
function selfHealBeliefInitialization() {
  try {
    console.log('[Belief 修復檢查] 啟動...');
    const profiles = student_profile;
    if (!profiles || profiles.length === 0) {
      console.log('[Belief 修復檢查] 沒有學生資料，跳過檢查。');
      return;
    }

    let relData = { members: [] };
    if (fs.existsSync(RELATIONSHIP_BELIEF_FILE)) {
      relData = JSON.parse(fs.readFileSync(RELATIONSHIP_BELIEF_FILE, 'utf8'));
    }

    // 檢查第一個學生是否需要初始化 Belief
    // 條件：relData 中有此學生，但其 belief.ideas 是空的
    const firstStudentName = profiles[0].name;
    const firstStudentRel = relData.members.find(m => m.name === firstStudentName);

    let needsRebuild = false;
    if (!firstStudentRel || !firstStudentRel.belief || !firstStudentRel.belief.ideas || Object.keys(firstStudentRel.belief.ideas).length === 0) {
        needsRebuild = true;
        console.log(`[Belief 修復檢查] 檢測到 Belief 未初始化 (檢查學生: ${firstStudentName})。將強制重建檔案...`);
    } else {
        console.log('[Belief 修復檢查] Belief 資料結構看起來是健康的，不需修復。');
    }

    if (needsRebuild) {
      const allNames = profiles.map(p => p.name);
      const rebuiltData = rebuildRelationshipBeliefFromNames(allNames, {
        seed: Date.now(),
        symmetric: false,
        relMin: -1.0,
        relMax: 1.0,
        initialIdeas: INITIAL_SIMULATOR_TOPICS
      });
      
      ensureDirFor(RELATIONSHIP_BELIEF_FILE);
      fs.writeFileSync(RELATIONSHIP_BELIEF_FILE, JSON.stringify(rebuiltData, null, 2), 'utf8');
      console.log(`[Belief 修復檢查] 成功！已為 ${allNames.length} 位學生重建 relationship_belief.json。`);
    }
  } catch (error) {
    console.error('[Belief 修復檢查] 執行時發生嚴重錯誤:', error);
  }
}

// 在伺服器啟動時執行一次自動修復
selfHealBeliefInitialization();
// =================================================================

const writeJson = (file, data) => {
    try {
        const json = JSON.stringify(data, null, 2)
        fs.writeFile(file, json, err => {
        if (err) console.error(`Failed to save ${file}:`, err)
        // else console.log(`Saved ${file} successfully`)
        })
    } catch (err) {
        console.error(`❌ JSON stringify failed for ${file}:`, err)
    }
}

// ... (後續 WebSocket 邏輯維持原樣，此處省略以保持簡潔) ...
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
  
  const broadcast = packet =>
    wss.clients.forEach(c =>
      c.readyState === c.OPEN && c.send(JSON.stringify(packet)))
  
  function sendMessage(diagram, replyMsg, chatroom_type) {
    let id = (chatroom_type === 'chatroom') ? diagram.currentNode : currentDiagramSimulator.currentNode
    let small_id = (chatroom_type === 'chatroom') ? diagram.currentNodeSmall : currentDiagramSimulator.currentNodeSmall
  
    let historyRef = (chatroom_type === 'chatroom') ? history : historySimulator
    let node = historyRef.find(n => n.id === id && n.small_id === small_id)
  
    if (node) {
      node.history.push(replyMsg);
    } else {
        historyRef.push({
            id: id,
            small_id: small_id,
            history: [replyMsg]
        });
    }
    saveHistory(chatroom_type);
    broadcast({ chatroom_type:chatroom_type, type: 'message', data: replyMsg });
  }
  
  async function runBeliefAndRelationship(latestMsg, flatHistory, relFile) {
    try {
      await updateBeliefWithLLM(latestMsg, flatHistory, relFile)
    } catch (e) {
      console.error('[runBR] belief update failed:', e)
    }
    try {
      await updateRelationshipWithLLM(latestMsg, flatHistory, relFile)
    } catch (e) {
      console.error('[runBR] relationship update failed:', e)
    }
  }
  
  async function tick_chatroom() {
    const { LLM_TOGGLE } = (JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')))
    if (LLM_TOGGLE) {
      try {
        let currentHistory = filterHistory(currentDiagram, history)
        const { replyMsg, stateDiagram: newStateDiagram, moveNode, nextReplyMsg, actionSuccess, startVoting} = await teacher_action(currentDiagram, currentHistory.slice(-15).map(msg => `${msg.user}: ${msg.text}`), null)
        
        if(actionSuccess){
          if (replyMsg && replyMsg.text && replyMsg.text !== 'null') {
            sendMessage(currentDiagram, replyMsg, "chatroom");
            const historyFlat = history.flatMap(n => n.history).slice(-50);
          }
          if (moveNode) {
            if (moveNode.nextNode === "big") newStateDiagram.currentNode = moveNode.nextNodeID;
            else if (moveNode.nextNode === "small") {
              newStateDiagram.currentNodeSmall = moveNode.nextNodeID;
              if(nextReplyMsg && nextReplyMsg.text && nextReplyMsg.text !== 'null'){
                sendMessage(currentDiagram, nextReplyMsg, "chatroom");
              }
            }
          }
          saveDiagram(newStateDiagram, "chatroom")
        }
      } catch (err) {
        console.error('tick_chatroom() failed:', err)
      }
    }
  }
  setInterval(tick_chatroom, 10000)
  
  let simulateStudentSpeakCool = false
  let lastReplyTime = 0
  let simulatorMessageQueue = []
  let simulatorVotingQueue = []
  
  async function sendMessageFromQueue(){
    const { RUN_TOGGLE_SIMULATOR } = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
    if(!RUN_TOGGLE_SIMULATOR) {
      simulatorMessageQueue = []
      return;
    }
    while(simulatorMessageQueue.length > 0 && simulatorMessageQueue[0].time.getTime() - lastReplyTime <  SIMULATOR_CONFIG.shareReplyInterval){
      simulatorMessageQueue.shift()
    }

    if(simulatorMessageQueue.length > 0){
      const randomIndex = Math.floor(Math.random() * simulatorMessageQueue.length);
      const selectedMsg = simulatorMessageQueue[randomIndex];
      
      const { diagram, msg: replyMsg, chatroom_type, time } = selectedMsg;

      // const diagram = simulatorMessageQueue[0].diagram
      // const replyMsg = simulatorMessageQueue[0].msg
      // const chatroom_type = simulatorMessageQueue[0].chatroom_type
      // const time = simulatorMessageQueue[0].time
      sendMessage(diagram, replyMsg, chatroom_type)

      console.log(time.getTime())
      console.log(lastReplyTime)

      lastReplyTime = time.getTime()
      simulatorMessageQueue.splice(randomIndex, 1);

      while(simulatorMessageQueue.length > 0 && simulatorMessageQueue[0].time.getTime() - lastReplyTime <  SIMULATOR_CONFIG.shareReplyInterval){
        simulatorMessageQueue.shift()
      }

      const rawH = (chatroom_type === 'chatroom') ? history : historySimulator;
      const historyFlat = rawH.flatMap(n => n.history).slice(-50);
      try {
        await runBeliefAndRelationship(selectedMsg.msg, historyFlat, RELATIONSHIP_BELIEF_FILE);
      }
      catch(e){
        if(DEBUG_CONFIG.consoleLogBELIEF){
          console.log("[BELIEF] server.mjs 中的 ws.on(...) (伺服器接收學生訊息處) 中的 runBeliefAndRelationship 報錯");
        }
      }

    }
  }

  function updateVotingFromQueue(){
    const { RUN_TOGGLE_SIMULATOR } = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
    if(!RUN_TOGGLE_SIMULATOR) {
      simulatorVotingQueue = []
      return;
    }
    let updateSuccess = false;
    while(simulatorVotingQueue.length > 0){
      updateSuccess = true
      let voted = false
      for(const voting of currentDiagramSimulator.voting_array){
        if(voting.user === simulatorVotingQueue[0].user){
          voted = true;
        }
      }
      if(!voted) {
        currentDiagramSimulator.voting_array.push(simulatorVotingQueue[0])
      }
      simulatorVotingQueue.shift()
    }
    if(updateSuccess){
      console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
      console.log(currentDiagramSimulator.voting_array)
    }
  }

  function clearQueue(){
    simulatorMessageQueue = []
  }
  
  setInterval(sendMessageFromQueue, SIMULATOR_CONFIG.processQueueInterval)
  setInterval(updateVotingFromQueue, 1000)
  
  async function tick_simulator() {
    const { RUN_TOGGLE_SIMULATOR } = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
    if (RUN_TOGGLE_SIMULATOR) {
      
      let currentHistory = filterHistory(currentDiagramSimulator, historySimulator).map(msg => `${msg.user}: ${msg.text}`)
      if(currentDiagramSimulator.currentNode !== "start"){ // 如果host還沒發言模擬學生就不能發話
        const studentTasks = student_profile.map(student =>
          student_action(currentDiagramSimulator, currentHistory, student).catch(e => {
              console.error(`Error in student_action for ${student.name}:`, e);
              return null; // 避免 Promise.all 中斷
          })
        );
        await Promise.all(studentTasks);
      }
  
      try {
        const { replyMsg, stateDiagram: newStateDiagram, nextReplyMsg: nextReply, actionSuccess, moveNodeSuccess, startVoting } = await teacher_action(currentDiagramSimulator, currentHistory.slice(-15), student_profile)
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.log("actionSuccess = " + actionSuccess)
        console.log("moveNodeSuccess = " + moveNodeSuccess)
        console.log("startVoting = " + startVoting)
        if(actionSuccess){
          if (replyMsg && replyMsg.text && replyMsg.text !== 'null') {
            // simulatorMessageQueue.push({
            //   diagram: currentDiagramSimulator,
            //   msg: replyMsg,
            //   chatroom_type: "simulator",
            //   time: new Date()
            // });
            sendMessage(currentDiagramSimulator, replyMsg, "simulator")
            const flatHist = historySimulator.flatMap(n => n.history).slice(-50)
            try {
              await runBeliefAndRelationship(replyMsg, flatHist, RELATIONSHIP_BELIEF_FILE)
            }
            catch(e){
              if(DEBUG_CONFIG.consoleLogBELIEF){
                console.log("[BELIEF] server.mjs 中的 tick_simulator() 中的 runBeliefAndRelationship 報錯");
              }
            }
          }

          if(nextReply && nextReply.text && nextReply.text !== 'null'){
            sendMessage(currentDiagramSimulator, nextReply, "simulator")
          }

          if(startVoting){
            newStateDiagram.voting = true;
            newStateDiagram.voting_array = []
          }

          if(moveNodeSuccess){  // 轉移節點時將投票模式關掉，且清空模擬學生訊息Queue
            newStateDiagram.voting = false;
            newStateDiagram.voting_array = []
            clearQueue()
          }

          saveDiagram(newStateDiagram, "simulator")
        }
      } catch (err) {
        console.error('tick_simulator() failed:', err)
      }
    }
  }
  
  setInterval(tick_simulator, 15000)
  SIMULATOR_TOGGLE_CLOSE()
  
  wss.on('connection', ws => {
    ws.send(JSON.stringify({ chatroom_type: 'chatroom', type: 'history', data: history }))
    ws.send(JSON.stringify({ chatroom_type: 'simulator', type: 'history', data: historySimulator }))
  
    ws.on('message', async raw => {
      try {
        const data = JSON.parse(raw)
        const { chatroom_type, msg_data } = data
        if (msg_data.role !== 'host') {
          if(chatroom_type === 'simulator'){  // 如果來自模擬聊天室並且是模擬學生，則加入Queue
            simulatorMessageQueue.push({
              diagram: currentDiagramSimulator,
              msg: msg_data,
              chatroom_type: "simulator",
              time: new Date()
            });
            console.log(JSON.stringify(msg_data))
          }
          else if(chatroom_type === 'simulator_voting'){
            simulatorVotingQueue.push({ user: msg_data.user })
          }
          else {
            sendMessage(currentDiagram, msg_data, chatroom_type);
          }
        }
      } catch (err) {
        console.error('Invalid message or LLM error:', err)
      }
    })
  })