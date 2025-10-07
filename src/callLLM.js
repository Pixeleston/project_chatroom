// callLLM.js
import fetch from 'node-fetch'
// npm install node-fetch
//import { encoding_for_model } from '@dqbd/tiktoken'
import { LLM_CONFIG } from './config.js'
import { OPENAI_API_KEY } from './config.js'

// export function countTokens(text, model = 'gpt-4') {
//   const encoder = encoding_for_model(model)
//   const tokens = encoder.encode(text)
//   return tokens.length
// }

/* ======================================
   model:
   "qwen:32b"
   "gpt-4o-mini"
   ====================================== */

const MODEL_MAP = {
  "qwen:32b": callOllama,
  "yi:9b": callOllama,
  "gpt-4o-mini": callGPT,
  "gpt-4o": callGPT
}


export async function callLLM(model, prompt, stop=null) {
  const handler = MODEL_MAP[model]
  if (!handler) {
    console.error(`no model : ${model}.\n Available models : ${OllamaList}\n, ${GPTList}\n`)
    return null
  }
  return handler(model, prompt, stop)
}

export async function callGPT(model, prompt, stop=null) {
  // 1️⃣ 計算 input tokens

  /*
  const encoder = encoding_for_model(model)
  const promptTokens = encoder.encode(prompt).length
  */

  // 2️⃣ 發送 API 請求
  let response
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: LLM_CONFIG.maxOutputTokens,
    stream: false,
    store: true,
  }

  if (stop) {
    body.stop = stop
  }

  response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    console.error(`❌ API 回應錯誤：${response.status}`)
    return null
  }

  const data = await response.json()
  const reply = data.choices?.[0]?.message?.content?.trim() ?? '(無回應)'
  const usage = data.usage || {}
/*
  const completionTokens = usage.completion_tokens ?? 0
  const totalTokens = usage.total_tokens ?? (promptTokens + completionTokens)

  // 3️⃣ 顯示 token 計算
  console.log("=============== Tokens Usage ===============")
  console.log(`🧮 Token 計算：
  - Input tokens: ${promptTokens}
  - Output tokens: ${completionTokens}
  - Total tokens: ${totalTokens}
  `)
  console.log("============================================")
*/

  return reply
}

async function callOllama(model, prompt, stop=null) {
  // const tokenCount = countTokens(prompt, "gpt-4o")

  // console.log("=============== Tokens Usage ===============")
  // console.log(`🧮 Input token count: ${tokenCount}`)
  // console.log("============================================")

  const url = "http://127.0.0.1:11434/api/generate"
  const body = {
    model: "qwen:32b",
    prompt,
    stream: false
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.error(`LLM response not ok: ${res.status}`)
      return "(錯誤：LLM 回應異常)"
    }

    const result = await res.json()
    return result.response?.trim() || "(錯誤：LLM 沒有回應)"
  } catch (err) {
    console.error("LLM fetch failed:", err.message)
    return "(錯誤：無法呼叫 LLM)"
  }
}