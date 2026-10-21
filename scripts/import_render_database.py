"""Back up local PostgreSQL and replace it with a Render PostgreSQL dump."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from dotenv import dotenv_values


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
BACKUPS = ROOT / "backups"
PG_BIN = Path(r"C:\Program Files\PostgreSQL\18\bin")


def pg_env(database_url: str) -> tuple[dict[str, str], str]:
    parsed = urlparse(database_url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ValueError("DATABASE_URL must use PostgreSQL.")
    if not parsed.hostname or not parsed.path.strip("/") or not parsed.username:
        raise ValueError("DATABASE_URL is missing PostgreSQL connection details.")

    env = os.environ.copy()
    env.update(
        {
            "PGHOST": parsed.hostname,
            "PGPORT": str(parsed.port or 5432),
            "PGDATABASE": unquote(parsed.path.lstrip("/")),
            "PGUSER": unquote(parsed.username),
            "PGPASSWORD": unquote(parsed.password or ""),
        }
    )
    query = parse_qs(parsed.query)
    if query.get("sslmode"):
        env["PGSSLMODE"] = query["sslmode"][0]
    return env, parsed.hostname.lower()


def run_pg(tool: str, args: list[str], env: dict[str, str]) -> None:
    executable = PG_BIN / f"{tool}.exe"
    if not executable.is_file():
        raise RuntimeError(f"PostgreSQL tool is missing: {executable}")
    result = subprocess.run(
        [str(executable), "--no-password", *args],
        cwd=BACKEND,
        env=env,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(f"{tool} failed with exit code {result.returncode}.")


def main() -> int:
    source_url = dotenv_values(BACKEND / ".env").get("DATABASE_URL")
    local_url = dotenv_values(BACKEND / ".env.local").get("DATABASE_URL")
    if not source_url or not local_url:
        raise RuntimeError("Set DATABASE_URL in backend/.env (Render) and backend/.env.local (local).")

    source_env, source_host = pg_env(source_url)
    local_env, local_host = pg_env(local_url)
    if not source_host.endswith(".render.com"):
        raise RuntimeError("The source in backend/.env is not a Render PostgreSQL host; refusing import.")
    if local_host not in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError("The target in backend/.env.local must be PostgreSQL on this computer.")

    print("Source: Render PostgreSQL")
    print("Target: local PostgreSQL")
    print("This replaces the target database. A local backup will be saved under backups/ first.")
    if input('Type IMPORT to continue: ').strip() != "IMPORT":
        print("Cancelled; no database changes made.")
        return 1

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    BACKUPS.mkdir(exist_ok=True)
    backup_path = BACKUPS / f"smartlivestock-local-before-render-{stamp}.dump"
    temp_dump = BACKUPS / f"smartlivestock-render-import-{stamp}.dump"

    try:
        print("Backing up local PostgreSQL...")
        run_pg("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", str(backup_path)], local_env)
        print("Exporting Render PostgreSQL...")
        run_pg("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", str(temp_dump)], source_env)
        print("Restoring Render data into local PostgreSQL...")
        run_pg("pg_restore", ["--clean", "--if-exists", "--exit-on-error", "--no-owner", "--no-privileges", "--dbname", local_env["PGDATABASE"], str(temp_dump)], local_env)
        print("Import complete. Local backup:", backup_path)
        return 0
    finally:
        temp_dump.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"Import stopped: {exc}", file=sys.stderr)
        raise SystemExit(1)
