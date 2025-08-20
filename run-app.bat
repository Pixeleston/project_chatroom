@echo off
cd /d "C:\Users\User\Downloads\project\APP"

start cmd /k "npm run dev"
start cmd /k "node server.mjs"

timeout /t 3 > nul
start http://localhost:5173/