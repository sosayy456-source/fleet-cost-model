@echo off
rem Install Node.js 22+, Python 3.11+ and ETL packages into etl\.venv (skips what is already installed)
rem Double-click this file. Logic is in tools\setup\setup.ps1
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\setup\setup.ps1"
pause
