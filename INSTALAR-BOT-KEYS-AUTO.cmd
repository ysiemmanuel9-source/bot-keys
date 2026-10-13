@echo off
cd /d "%~dp0"
title Instalar bot de keys automatico

set "BOTDIR=%~dp0"
set "TASKNAME=CENTRAL KEYS Discord Bot"
set "SCRIPT=%BOTDIR%BOT-KEYS-SIEMPRE-ONLINE.cmd"

echo Instalando inicio automatico para el bot de keys...
echo.

schtasks /Create /F /TN "%TASKNAME%" /SC ONLOGON /RL HIGHEST /TR "\"%SCRIPT%\""
if errorlevel 1 (
  echo.
  echo No pude crear la tarea automatica.
  echo Abre este archivo como administrador y vuelve a intentarlo.
  pause
  exit /b 1
)

echo.
echo Listo. El bot se abrira solo cuando prendas la PC e inicies sesion.
echo Ahora lo voy a iniciar.
echo.
schtasks /Run /TN "%TASKNAME%"
pause
