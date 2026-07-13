@echo off
REM Double-click this file to start Nexus Protocol.
REM It starts the dev server (if it isn't already running) and opens
REM http://localhost:3000 in your default browser once it's ready.

cd /d "%~dp0"

set "URL=http://localhost:3000"

echo Checking if the Nexus Protocol server is already running...
call :check_server
if "%SERVER_UP%"=="1" (
    echo Server already running. Opening browser...
    start "" "%URL%"
    goto :end
)

echo Starting the Nexus Protocol dev server...
start "Nexus Protocol - Dev Server" cmd /k "npm run dev"

echo Waiting for the server to be ready...
set /a TRIES=0
:waitloop
set /a TRIES+=1
timeout /t 1 /nobreak >nul
call :check_server
if "%SERVER_UP%"=="1" goto ready
if %TRIES% GEQ 60 (
    echo Server did not respond after 60 seconds. Opening browser anyway...
    goto ready
)
goto waitloop

:ready
echo Server is ready. Opening browser...
start "" "%URL%"
goto :end

:check_server
set "SERVER_UP=0"
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 set "SERVER_UP=1"
goto :eof

:end
