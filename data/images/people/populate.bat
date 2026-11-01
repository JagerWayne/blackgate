@echo off
rem Rebuilds index.json from the images in the male and female folders.
rem Run it (double-click) after adding or removing portraits.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not on the PATH: https://nodejs.org/
  pause
  exit /b 1
)
node "%~dp0..\..\..\tools\portraits.mjs"
pause
