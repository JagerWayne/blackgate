@echo off
rem Pick an npm command to run for BLACKGATE. Run it from anywhere: it moves to its own folder first.
cd /d "%~dp0"
title BLACKGATE build

:menu
cls
echo.
echo   BLACKGATE build menu
echo   --------------------
echo.
echo    1  start      build v2 and run it in Electron
echo    2  ui         dev server with live reload (Vite)
echo    3  ui:build   production build into v2\dist
echo    4  test       run the test suite
echo    5  dist       build the app, zip and launcher into dist\ (no upload)
echo    6  release    same as dist, then upload to the GitHub release
echo    7  install    npm install
echo.
echo    0  quit
echo.
choice /c 12345670 /n /m "  Pick 0-7: "
set pick=%errorlevel%
if %pick%==8 exit /b 0

if %pick%==6 (
  echo.
  echo   release uploads to GitHub for the version in package.json.
  choice /c yn /n /m "  Are you sure? [y/n] "
  if errorlevel 2 goto menu
)

set cmd=
if %pick%==1 set cmd=npm start
if %pick%==2 set cmd=npm run ui
if %pick%==3 set cmd=npm run ui:build
if %pick%==4 set cmd=npm test
if %pick%==5 set cmd=npm run dist
if %pick%==6 set cmd=npm run release
if %pick%==7 set cmd=npm install

echo.
echo   ^> %cmd%
echo.
call %cmd%
echo.
echo   Finished with exit code %errorlevel%.
pause
goto menu
