@echo off
REM Double-click this file (or the "Play Nexus Protocol" shortcut) to start Nexus Protocol.
REM First run: installs dependencies, creates your local env file, syncs the database,
REM and repairs the desktop shortcut if it was cloned to a new location.
REM Every run: starts the dev server (if it isn't already running) and opens
REM http://localhost:3000 in your default browser once it's ready.

cd /d "%~dp0"

set "FIRST_SETUP=0"

REM --- Dependencies ---
if not exist "node_modules" (
    echo Installing dependencies with "npm install"... this can take a few minutes the first time.
    call npm install
    if errorlevel 1 (
        echo npm install failed - see the errors above.
        pause
        exit /b 1
    )
)

REM --- Local environment file ---
if not exist ".env.local" (
    set "FIRST_SETUP=1"
    copy /y ".env.example" ".env.local" >nul
    echo.
    echo Created .env.local from .env.example.
    echo Fill in DATABASE_URL, DIRECT_URL, JWT_SECRET, and GROQ_API_KEY
    echo ^(see README.md for where to get each one^), then save and close Notepad.
    echo.
    notepad ".env.local"
    echo Press any key once you've saved .env.local to continue...
    pause >nul
)

REM --- Database schema (only needed once, right after .env.local is first filled in) ---
if "%FIRST_SETUP%"=="1" (
    echo Syncing the database schema with "npm run db:push"...
    call npm run db:push
    if errorlevel 1 (
        echo db:push failed - double check DATABASE_URL/DIRECT_URL in .env.local, then re-run this file.
        pause
        exit /b 1
    )
)

REM --- Repair the shortcut if it's missing or points at a different clone location ---
powershell -NoProfile -Command "$p='%~dp0Play Nexus Protocol.lnk'; $ws=New-Object -ComObject WScript.Shell; $needsFix=$true; if (Test-Path $p) { $l=$ws.CreateShortcut($p); if (Test-Path $l.TargetPath) { $needsFix=$false } }; if ($needsFix) { $lnk=$ws.CreateShortcut($p); $lnk.TargetPath='%~dp0start-nexus-protocol.bat'; $lnk.WorkingDirectory='%~dp0'; $lnk.IconLocation='%~dp0nexus-icon.ico,0'; $lnk.Save() }" >nul 2>&1

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
