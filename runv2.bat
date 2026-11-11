@echo off
rem BLACKGATE v2: starts the DOM + Tailwind version (v2/) with the Vite dev server
rem and opens it in the browser. The classic canvas game is still run.bat.
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo npm not found. Install Node.js.
  pause
  exit /b 1
)
if not exist node_modules call npm install
call npm run ui -- --open
if errorlevel 1 pause
