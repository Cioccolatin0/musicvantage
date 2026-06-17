@echo off
set NODE_ENV=development
set PORT=4000
start /MIN "" "node" --import "file:///C:/Users/Edoardo/Downloads/Creazione%20di%20un%27app%20musicale%20per%20web%20e%20iOS%20funzionante/node_modules/tsx/dist/loader.mjs" "C:\Users\Edoardo\Downloads\Creazione%20di%20un%27app%20musicale%20per%20web%20e%20iOS%20funzionante\server\index.ts"
timeout /t 5 /nobreak >nul
echo Server started
