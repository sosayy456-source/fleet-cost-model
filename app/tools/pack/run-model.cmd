@echo off
rem Open the Fleet Cost Model at http://localhost:4174/fleet-cost-model/
rem Double-click this file, or open cmd in this folder and type: run-model
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if errorlevel 1 pause
