@echo off
cd /d "%~dp0"
title CENTRAL KEYS - siempre online

if not exist logs mkdir logs

:inicio
echo [%date% %time%] Iniciando bot de keys...
npm start >> logs\bot-keys.log 2>&1
echo [%date% %time%] El bot se cerro. Reiniciando en 5 segundos... >> logs\bot-keys.log
timeout /t 5 /nobreak >nul
goto inicio
