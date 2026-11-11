@echo off
rem Rebuilds images.json (the photos in each topic folder) and text.json (from text.txt).
rem Run it (double-click) after adding photos or lines of text.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not on the PATH: https://nodejs.org/
  pause
  exit /b 1
)
node "%~dp0..\..\..\tools\socialmedia.mjs"
pause
