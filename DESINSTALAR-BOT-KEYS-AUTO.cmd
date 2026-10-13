@echo off
title Quitar bot de keys automatico
schtasks /Delete /F /TN "CENTRAL KEYS Discord Bot"
echo Listo. Ya no se iniciara automatico.
pause
