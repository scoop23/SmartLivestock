@echo off
setlocal
cd /d "%~dp0..\backend"
set "DATABASE_URL="
set "SMARTLIVESTOCK_ENV_FILE=.env.local"
if exist ".venv\Scripts\python.exe" (set "DJANGO_PYTHON=.venv\Scripts\python.exe") else (set "DJANGO_PYTHON=python")
"%DJANGO_PYTHON%" manage.py runserver 127.0.0.1:8000
endlocal
