export const LLM_CONFIG = {
  maxOutputTokens: 1200,
  temperature: 0.7,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  custom_memory: true
}

export const SIMULATOR_CONFIG = {
  shareReplyInterval: 4000,
  replyIntervalMin: 4000,
  replyIntervalMax: 8000,
  processQueueInterval: 1000,
  votingRatio: 0.5 // this means ">=" 
}

export const REAL_CONFIG = {
  votingRatio: 1.0
}

export const DEBUG_CONFIG = {
  consoleLogRelationship: false,   // 所有 [relationship] 開頭的 console.log() console.error() console.warn() 都由這個顯示
  consoleLogStudentPrompt: false,  // 所有 [student-prompt] 開頭的 console.log() console.error() console.warn() 都由這個顯示
  consoleLogTeacherPrompt: true,   // prompt_teacher() 中的 console.log() console.error() console.warn() 由這個顯示
  consoleLogBelief: false,         // 所有 [belief] 開頭的 console.log() console.error() console.warn() 都由這個顯示
  consoleLogBELIEF: false           // 若有任何一個belief出錯，都會由這邊統一報錯，而不會有很多行的錯誤訊息
}

export const TOKEN_CONFIG = {
  consoleLogToken: false
}

export const ADDRESS_CONFIG = {
  //ADDRESS_3000:"https://add8ee5a4396.ngrok-free.app",
  //WEBSOCKET_3000:"wss://add8ee5a4396.ngrok-free.app"
  ADDRESS_3000:"http://localhost:3000",
  WEBSOCKET_3000:"ws://localhost:3000"//,
  //ADDRESS_ngrok:"f33b8741a866.ngrok-free.app"
}

//C:\Users\User\AppData\Local/ngrok/ngrok.yml

export const OPENAI_API_KEY = ''