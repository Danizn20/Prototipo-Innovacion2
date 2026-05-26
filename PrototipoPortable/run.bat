@echo off
cd %~dp0
powershell -Command "Start-Process 'prototipo_innovacion.exe' -WindowStyle Hidden"
exit