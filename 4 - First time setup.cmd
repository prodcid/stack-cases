@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call "%~dp0_findnode.cmd" || goto :nonode

echo.
echo   ==========================================================
echo    ONE-TIME SETUP - STACK CASES
echo   ==========================================================
echo.
echo   Before running this you need:
echo.
echo     An EMPTY PUBLIC repo named "stack-cases" on GitHub.
echo     Make it at github.com/new
echo       - tick Public
echo       - do NOT tick any "add a README" boxes
echo.
echo   If you have not done that yet, close this and do it first.
echo.
pause
echo.
set "GHUSER="
set /p "GHUSER=Your GitHub username (press Enter for prodcid): "
if "!GHUSER!"=="" set "GHUSER=prodcid"

echo.
"%NODEEXE%" ship.js setup "!GHUSER!" stack-cases
if errorlevel 1 goto :failed

echo.
echo   ----------------------------------------------------------
echo   Setup done. Now run "3 - Ship to mate.cmd" once to put the
echo   first build up, then send your mate launcher.html.
echo   ----------------------------------------------------------
goto :end

:failed
echo.
echo   Setup failed. The reason is printed above - paste it to Claude.
goto :end

:nonode
echo.
echo   Could not find Node.js on this computer.
echo   Tell Claude "node is missing" and it will sort it.

:end
echo.
pause
