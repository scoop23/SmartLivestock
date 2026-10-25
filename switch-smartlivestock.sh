#!/usr/bin/env bash
set -u

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
SCRIPTS="$ROOT/scripts"

run_backend_python() {
  if command -v pipenv >/dev/null 2>&1 && [[ -f "$BACKEND/Pipfile" ]]; then
    (cd "$BACKEND" && pipenv run python "$@")
  elif [[ -x "$BACKEND/.venv/bin/python" ]]; then
    (cd "$BACKEND" && .venv/bin/python "$@")
  elif command -v python3 >/dev/null 2>&1; then
    (cd "$BACKEND" && python3 "$@")
  else
    (cd "$BACKEND" && python "$@")
  fi
}

pause_for_enter() {
  read -r -p "Press Enter to continue..." _
}

terminal_available() {
  [[ -n "${WEZTERM_PANE:-}" ]] && command -v wezterm >/dev/null 2>&1 ||
    command -v gnome-terminal >/dev/null 2>&1 ||
    command -v konsole >/dev/null 2>&1 ||
    command -v x-terminal-emulator >/dev/null 2>&1
}

launch_terminal() {
  local title="$1" script="$2" command_text
  printf -v command_text 'exec %q' "$script"
  if [[ -n "${WEZTERM_PANE:-}" ]] && command -v wezterm >/dev/null 2>&1; then
    wezterm cli spawn --cwd "$ROOT" -- bash -lc "$command_text" >/dev/null
  elif command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal --title="$title" --working-directory="$ROOT" -- bash -lc "$command_text"
  elif command -v konsole >/dev/null 2>&1; then
    konsole --separate --workdir "$ROOT" -e bash -lc "$command_text" >/dev/null 2>&1 &
  elif command -v x-terminal-emulator >/dev/null 2>&1; then
    x-terminal-emulator -T "$title" -e bash -lc "$command_text"
  else
    return 1
  fi
}

launch_local() {
  if [[ ! -f "$BACKEND/.env.local" ]]; then
    echo "Local mode needs backend/.env.local. Copy backend/.env.example to backend/.env.local,"
    echo "then set DATABASE_URL to your local PostgreSQL connection string in that ignored file."
    return 1
  fi

  echo "Checking that local mode points to PostgreSQL on this computer..."
  (
    cd "$BACKEND"
    unset DATABASE_URL
    export SMARTLIVESTOCK_ENV_FILE=.env.local
    run_backend_python manage.py shell -c "from django.db import connection; host=connection.settings_dict.get('HOST') or ''; print('Database:', connection.vendor, host or '(local socket)'); allowed=connection.vendor == 'postgresql' and host.lower() in ('','localhost','127.0.0.1','::1'); assert allowed, 'Local mode requires PostgreSQL on localhost or a local socket'; connection.ensure_connection(); print('Local PostgreSQL connection OK')"
  ) || {
    echo "Local mode stopped. No server was started. Check backend/.env.local and local PostgreSQL."
    return 1
  }

  echo "Starting local Django and Next.js. Close previous SmartLivestock servers before switching modes."
  if terminal_available; then
    launch_terminal "SmartLivestock Local Django" "$SCRIPTS/smartlivestock-local-backend.sh" || return 1
    launch_terminal "SmartLivestock Local Website" "$SCRIPTS/smartlivestock-frontend-local.sh" || {
      echo "Django started, but the website terminal could not be opened."
      return 1
    }
  else
    echo "No supported terminal launcher found; running both servers in this terminal."
    run_both_local
  fi
}

run_both_local() {
  ( exec "$SCRIPTS/smartlivestock-local-backend.sh" ) &
  local backend_pid=$!
  ( exec "$SCRIPTS/smartlivestock-frontend-local.sh" ) &
  local frontend_pid=$!
  trap 'kill "$backend_pid" "$frontend_pid" 2>/dev/null || true' INT TERM EXIT
  wait -n "$backend_pid" "$frontend_pid"
  local result=$?
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
  wait "$backend_pid" "$frontend_pid" 2>/dev/null || true
  trap - INT TERM EXIT
  return "$result"
}

local_menu() {
  while true; do
    echo
    echo "Local mode uses backend/.env.local and requires PostgreSQL on localhost."
    echo "  S - Start local website and backend"
    echo "  I - Import Aiven database to local PostgreSQL, then start"
    echo "  B - Back"
    read -r -n 1 -p "Press S, I, or B: " choice
    echo
    case "${choice,,}" in
      s) launch_local; pause_for_enter; return ;;
      i)
        echo "Stop any running local Django server first. Import replaces the local database."
        if [[ ! -f "$BACKEND/.env.aiven.local" ]]; then
          echo "Aiven source config is missing: backend/.env.aiven.local"
          echo "Create it with the Aiven PostgreSQL DATABASE_URL from your Aiven service."
          echo "Do not use the Render hostname in backend/.env; this import requires the Aiven host."
          pause_for_enter
          return
        fi
        if python3 "$SCRIPTS/import_render_database.py" --provider aiven --source-env .env.aiven.local; then
          launch_local
        else
          echo "Import did not complete. Local servers were not started."
        fi
        pause_for_enter
        return
        ;;
      b) return ;;
      *) echo "Choose S, I, or B." ;;
    esac
  done
}

launch_aiven_frontend() {
  echo "Starting the local website against the deployed Render Django backend."
  echo "The Render backend should use DATABASE_URL for the Aiven PostgreSQL service."
  echo "This starts only the frontend; Django runs on Render."
  if terminal_available; then
    launch_terminal "SmartLivestock Aiven-backed Website" "$SCRIPTS/smartlivestock-frontend-render.sh"
  else
    exec "$SCRIPTS/smartlivestock-frontend-render.sh"
  fi
}

while true; do
  echo
  echo "SmartLivestock environment switch"
  echo "  L - Local Django + local PostgreSQL database"
  echo "  A - Local website + Render Django backend connected to Aiven PostgreSQL"
  echo "  Q - Quit"
  read -r -n 1 -p "Press L, A, or Q: " choice
  echo
  case "${choice,,}" in
    l) local_menu ;;
    a) launch_aiven_frontend; break ;;
    q) break ;;
    *) echo "Choose L, A, or Q." ;;
  esac
done
