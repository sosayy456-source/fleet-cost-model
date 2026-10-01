@echo off
rem Open the Fleet Cost Model at http://localhost:4174/fleet-cost-model/
rem Double-click this file, or open cmd in this folder and type: run-model
rem keep the folder before cd: %~dp0 of a relative call resolves against the new current dir and doubles
set "HERE=%~dp0"
cd /d "%HERE%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%server.ps1"
if errorlevel 1 pause
