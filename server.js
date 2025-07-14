const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HISTORY_FILE = path.join(__dirname, 'history.json');
const MEMORY_FILE = path.join(__dirname, 'memory.json');

// last_10, summary
const MEMORY_MODE = 'last_10';

const wss = new WebSocket.Server({ port: PORT });

let history = [];

let headerPrompt = [
  `你是這個聊天室的主持人，要用繁體中文與使用者互動。
  - 回應要友善、親切、有鼓勵性
  - 不要一次講太多話，請保持回覆精簡，少於100字
  - 如果使用者不清楚問題，可以請他說得更清楚
  - 每次請只講一句話或一個想法即可，不要長篇大論`
];

let hostMemory = [];

// ✅ 啟動時載入歷史訊息
if (fs.existsSync(HISTORY_FILE)) {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    history = JSON.parse(raw);
    console.log(`Loaded ${history.length} messages from history.json`);
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

if (fs.existsSync(MEMORY_FILE)) {
  try {
    const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
    hostMemory = JSON.parse(raw);
    console.log(`Loaded ${history.length} messages from memory.json`);
  } catch (err) {
    console.error('Failed to load memory:', err);
  }
}

// ✅ 寫入檔案的函式
function saveHistoryToFile() {
  fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), (err) => {
    if (err) console.error('Failed to save history:', err);
  });
}

function saveMemoryToFile() {
  fs.writeFile(MEMORY_FILE, JSON.stringify(hostMemory, null, 2), (err) => {
    if (err) console.error('Failed to save memory:', err);
  });
}

function updateMemory() {
  if (MEMORY_MODE === 'last_10') {
    const recentUserMessages = history
      .filter(msg => msg.user !== 'Host')
      .slice(-10)
      .map(msg => `${msg.user}: ${msg.text}`);

    hostMemory = [...recentUserMessages];
    saveMemoryToFile();
  } else {
    saveMemoryToFile();
  }
}

function broadcast(packet) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(packet));
    }
  });
}

function makePrompt(data){
  let prompt = headerPrompt;
  prompt = [prompt,
    '\n以下是歷史對話：',
    hostMemory.join('\n'),
    '\n歷史對話結束，請根據以下使用者的最新訊息回覆：\n',
    `${data.user}: ${data.text}`
  ]
  return prompt.join('\n');
}

wss.on('connection', (ws) => {
  // 傳送歷史紀錄
  ws.send(JSON.stringify({ type: 'history', data: history }));

  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);
      history.push(data);
      saveHistoryToFile();
      updateMemory();

      broadcast({ type: 'message', data });

      // 產生主持人回應
      if (data.user !== 'Host') {

        const prompt = makePrompt(data);
        console.log(prompt);
        const res = await fetch("http://localhost:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "qwen:32b", prompt, stream: false })
        });

        const result = await res.json();
        const reply = result.response.trim();
        hostMemory.push(`Host: ${reply}`);

        const replyMsg = { user: 'Host', text: reply };
        history.push(replyMsg);
        saveHistoryToFile();
        updateMemory();

        broadcast({ type: 'message', data: replyMsg });
      }
    } catch (err) {
      console.error('Invalid message:', err);
    }
  });
});

console.log(`✅ WebSocket server running at ws://localhost:${PORT}`);