@echo off
setlocal
cd /d "%~dp0..\backend"
if exist ".venv\Scripts\python.exe" (set "SL_PYTHON=.venv\Scripts\python.exe") else (set "SL_PYTHON=python")
"%SL_PYTHON%" ..\scripts\import_render_database.py
set "IMPORT_EXIT=%ERRORLEVEL%"
endlocal & exit /b %IMPORT_EXIT%
