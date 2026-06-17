@echo off
cd /d "C:\Users\Edoardo\Downloads\Creazione di un'app musicale per web e iOS funzionante" || exit /b 1
echo Starting servers...

:: Start Express API server in background
start /B "" "node" --import "file:///C:/Users/Edoardo/Downloads/Creazione%20di%20un'app%20musicale%20per%20web%20e%20iOS%20funzionante/node_modules/tsx/dist/loader.mjs" server/index.ts

:: Wait a bit for Express to start
timeout /t 8 /nobreak >nul

:: Start Vite dev server in background
start /B "" "node" .\node_modules\vite\bin\vite.js

echo.
echo ============================================
echo  Servers avviati!
echo  Frontend: http://localhost:8080/
echo  Backend:  http://localhost:3000/
echo ============================================
echo.
echo  Premi Ctrl+C per fermare i server
echo.

:: Wait forever so the window stays open
pause >nul
