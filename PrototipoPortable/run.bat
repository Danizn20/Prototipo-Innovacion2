@echo off
cd %~dp0
powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "start.ps1"
exit