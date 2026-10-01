@echo off
rem Install Node.js 22+, Python 3.11+ and ETL packages into etl\.venv (skips what is already installed)
rem Double-click this file. Logic is in tools\setup\setup.ps1
rem keep the folder before cd: %~dp0 of a relative call resolves against the new current dir and doubles
set "HERE=%~dp0"
cd /d "%HERE%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%tools\setup\setup.ps1"
pause
