import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import './assets/style.css'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const app = createApp(App)
const pinia = createPinia()          // ✅ 加這行
app.use(pinia)

app.mount('#app')