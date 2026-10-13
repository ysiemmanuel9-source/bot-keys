@echo off
cd /d "%~dp0"
if not exist logs\bot-keys.log (
  echo Todavia no hay log.
  pause
  exit /b 0
)
type logs\bot-keys.log
pause
