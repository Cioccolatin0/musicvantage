@echo off
cd /d "C:\Users\Edoardo\Downloads\Creazione di un'app musicale per web e iOS funzionante"

:: Start Express API server (detached)
start /B "" node --import "file:///C:/Users/Edoardo/Downloads/Creazione%20di%20un'app%20musicale%20per%20web%20e%20iOS%20funzionante/node_modules/tsx/dist/loader.mjs" server/index.ts > server.log 2>&1

:: Wait and start Vite (detached)
timeout /t 8 /nobreak >nul
start /B "" node .\node_modules\vite\bin\vite.js > vite.log 2>&1

echo Both servers started in background.
echo Frontend: http://localhost:8080/
echo Backend: http://localhost:3000/
