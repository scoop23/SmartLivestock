@echo off
setlocal
cd /d "%~dp0"

:menu
echo.
echo SmartLivestock environment switch
echo   L - Local Django + local PostgreSQL database
echo   A - Local website + Render Django backend connected to Aiven PostgreSQL
echo   Q - Quit
echo.
echo Press one key to choose; you do not need to press Enter.
choice /c LAQ /n /m "Press L, A, or Q: "
if errorlevel 3 goto done
if errorlevel 2 goto aiven
if errorlevel 1 goto local

:local
echo.
if not exist "%~dp0backend\.env.local" (
    echo Local mode needs backend\.env.local. Copy backend\.env.example to backend\.env.local,
    echo then set DATABASE_URL to your local PostgreSQL connection string in that ignored file.
    pause
    goto menu
)
echo Local mode uses backend\.env.local and requires PostgreSQL on localhost.
echo   S - Start local website and backend
echo   I - Import Render database to local PostgreSQL, then start
echo   B - Back
echo Press one key to choose; you do not need to press Enter.
choice /c SIB /n /m "Press S, I, or B: "
if errorlevel 3 goto menu
if errorlevel 2 goto import_render

goto local_start

:import_render
echo.
echo Stop any running local Django server first. Import replaces the local database.
call "%~dp0scripts\import-render-database.cmd"
if errorlevel 1 (
    echo Import did not complete. Local servers were not started.
    pause
    goto menu
)

:local_start
echo The launcher will check that before starting anything.
pushd "%~dp0backend"
set "DATABASE_URL="
set "SMARTLIVESTOCK_ENV_FILE=.env.local"
if exist ".venv\Scripts\python.exe" (set "DJANGO_PYTHON=.venv\Scripts\python.exe") else (set "DJANGO_PYTHON=python")
"%DJANGO_PYTHON%" manage.py shell -c "from django.db import connection; host=connection.settings_dict.get('HOST') or ''; print('Database:', connection.vendor, host or '(no host)'); allowed=connection.vendor == 'postgresql' and host.lower() in ('localhost','127.0.0.1','::1'); assert allowed, 'Local mode requires PostgreSQL on localhost'; connection.ensure_connection(); print('Local PostgreSQL connection OK')"
set "PREFLIGHT_EXIT=%ERRORLEVEL%"
popd
if not "%PREFLIGHT_EXIT%"=="0" (
    echo.
    echo Local mode stopped. No server was started. Set backend\.env.local DATABASE_URL to your local PostgreSQL connection.
    pause
    goto menu
)
echo.
echo Starting local Django and Next.js. Close any previous SmartLivestock server windows before switching modes.
echo The backend and website will open in separate terminal windows.
where wezterm >nul 2>nul
if not errorlevel 1 if defined WEZTERM_PANE goto local_wezterm
start "SmartLivestock Local Django" "%ComSpec%" /k ""%~dp0scripts\smartlivestock-local-backend.cmd""
start "SmartLivestock Local Website" "%ComSpec%" /k ""%~dp0scripts\smartlivestock-frontend-local.cmd""
goto done

:local_wezterm
set "LOCAL_BACKEND_PANE="
for /f "delims=" %%P in ('wezterm cli spawn --cwd "%~dp0." -- cmd.exe /d /k call "%~dp0scripts\smartlivestock-local-backend.cmd"') do set "LOCAL_BACKEND_PANE=%%P"
if not defined LOCAL_BACKEND_PANE (
    echo Could not open the Django tab in WezTerm. Run scripts\smartlivestock-local-backend.cmd manually.
    pause
    goto done
)
set "LOCAL_FRONTEND_PANE="
for /f "delims=" %%P in ('wezterm cli spawn --cwd "%~dp0." -- cmd.exe /d /k call "%~dp0scripts\smartlivestock-frontend-local.cmd"') do set "LOCAL_FRONTEND_PANE=%%P"
if not defined LOCAL_FRONTEND_PANE (
    echo The Django tab started, but the website tab could not be opened. Run scripts\smartlivestock-frontend-local.cmd manually.
    pause
    wezterm cli activate-pane --pane-id %LOCAL_BACKEND_PANE% >nul 2>nul
    goto done
)
wezterm cli activate-pane --pane-id %LOCAL_FRONTEND_PANE%
if errorlevel 1 echo Both servers were launched, but WezTerm could not focus the website tab.
goto done

:aiven
echo.
echo Starting the local website against the deployed Render Django backend.
echo The Render backend should have DATABASE_URL set to your Aiven PostgreSQL service.
echo This starts only the local frontend; Django connects to Aiven through its backend configuration.
echo Close any previous SmartLivestock server windows before switching modes.
echo The website will open in a separate terminal window.
where wezterm >nul 2>nul
if not errorlevel 1 if defined WEZTERM_PANE goto aiven_wezterm
start "SmartLivestock Aiven-backed Website" "%ComSpec%" /k ""%~dp0scripts\smartlivestock-frontend-render.cmd""
goto done

:aiven_wezterm
set "AIVEN_FRONTEND_PANE="
for /f "delims=" %%P in ('wezterm cli spawn --cwd "%~dp0." -- cmd.exe /d /k call "%~dp0scripts\smartlivestock-frontend-render.cmd"') do set "AIVEN_FRONTEND_PANE=%%P"
if not defined AIVEN_FRONTEND_PANE (
    echo Could not open the website tab in WezTerm. Run scripts\smartlivestock-frontend-render.cmd manually.
    pause
    goto done
)
wezterm cli activate-pane --pane-id %AIVEN_FRONTEND_PANE%
if errorlevel 1 echo The website started, but WezTerm could not focus its tab.
goto done

:done
endlocal
