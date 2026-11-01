@echo off
rem BLACKGATE: serves the game on http://localhost:8001/ and opens
rem it in a browser. Any static file server works; the first one found is
rem used. Ctrl+C stops it.
cd /d "%~dp0"
set "PORT=8001"
set "URL=http://localhost:%PORT%/"

rem Open the browser a moment after the server has come up.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process '%URL%'"

where python >nul 2>nul
if not errorlevel 1 (
  python -m http.server %PORT%
  goto :done
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -m http.server %PORT%
  goto :done
)
where npx >nul 2>nul
if not errorlevel 1 (
  npx --yes serve -l %PORT% .
  goto :done
)

echo No static file server found. Install Python 3 or Node.js.
pause
:done
if errorlevel 1 pause
