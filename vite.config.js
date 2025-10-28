import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // 對外開放存取
    allowedHosts: [
      //ADDRESS_CONFIG.ADDRESS_ngrok // 允許的 ngrok domain
      //'9b23058fd5e2.ngrok-free.app' 
      '.ngrok-free.app'
    ]
  }
})