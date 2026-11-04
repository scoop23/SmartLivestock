@echo off
setlocal
cd /d "%~dp0..\frontend"
set "NEXT_PUBLIC_API_URL=http://localhost:8000"
set "NEXT_PUBLIC_LOCAL_API_URL=http://localhost:8000"
set "NEXT_PUBLIC_RENDER_API_URL=https://smartlivestock-xkx4.onrender.com"
set "NEXT_PUBLIC_FALLBACK_API_URL=http://localhost:8000"
set "NEXT_PUBLIC_ENABLE_CLOUD_FALLBACK=false"
call npm.cmd run dev
endlocal
