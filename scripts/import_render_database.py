"""Back up local PostgreSQL and replace it with a configured remote PostgreSQL dump."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import argparse
from getpass import getuser
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from dotenv import dotenv_values


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
BACKUPS = ROOT / "backups"
PG_BIN = Path(r"C:\Program Files\PostgreSQL\18\bin")


def pg_env(database_url: str, *, allow_local_socket: bool = False) -> tuple[dict[str, str], str]:
    parsed = urlparse(database_url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ValueError("DATABASE_URL must use PostgreSQL.")
    if (not parsed.hostname and not allow_local_socket) or not parsed.path.strip("/"):
        raise ValueError("DATABASE_URL is missing PostgreSQL connection details.")
    if not parsed.username and not allow_local_socket:
        raise ValueError("The remote DATABASE_URL must include a database username.")

    env = os.environ.copy()
    env["PGDATABASE"] = unquote(parsed.path.lstrip("/"))
    env["PGUSER"] = unquote(parsed.username) if parsed.username else getuser()
    if parsed.hostname:
        env["PGHOST"] = parsed.hostname
    else:
        env.pop("PGHOST", None)
    if parsed.port:
        env["PGPORT"] = str(parsed.port)
    else:
        env.pop("PGPORT", None)
    if parsed.password:
        env["PGPASSWORD"] = unquote(parsed.password)
    else:
        env.pop("PGPASSWORD", None)
    query = parse_qs(parsed.query)
    if query.get("sslmode"):
        env["PGSSLMODE"] = query["sslmode"][0]
    else:
        env.pop("PGSSLMODE", None)
    return env, (parsed.hostname or "").lower()


def run_pg(tool: str, args: list[str], env: dict[str, str]) -> None:
    executable = resolve_pg_tool(tool, env)
    if not executable:
        raise RuntimeError(f"PostgreSQL tool is missing from PATH: {tool}")
    result = subprocess.run(
        [executable, "--no-password", *args],
        cwd=BACKEND,
        env=env,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(f"{tool} failed with exit code {result.returncode}.")


def postgres_server_major(env: dict[str, str]) -> int | None:
    windows_psql = PG_BIN / "psql.exe"
    psql = str(windows_psql) if os.name == "nt" and windows_psql.is_file() else shutil.which("psql")
    if not psql:
        return None
    result = subprocess.run(
        [psql, "-X", "-w", "-A", "-t", "-c", "SHOW server_version_num"],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode or not result.stdout.strip().isdigit():
        return None
    return int(result.stdout.strip()) // 10000


def resolve_pg_tool(tool: str, env: dict[str, str]) -> str | None:
    windows_executable = PG_BIN / f"{tool}.exe"
    if os.name == "nt" and windows_executable.is_file():
        return str(windows_executable)

    server_major = postgres_server_major(env)
    if server_major:
        candidates: list[tuple[int, Path]] = []
        for pattern in (f"pgsql-*/bin/{tool}", f"lib/postgresql/*/bin/{tool}"):
            for path in Path("/usr").glob(pattern):
                version_directory = path.parents[1].name
                version_text = version_directory.removeprefix("pgsql-")
                if version_text.isdigit():
                    candidates.append((int(version_text), path))
        compatible = sorted((version, path) for version, path in candidates if version >= server_major)
        exact = next((path for version, path in candidates if version == server_major), None)
        if exact and exact.is_file():
            return str(exact)
        if compatible and compatible[0][1].is_file():
            return str(compatible[0][1])
    return shutil.which(tool)


def main() -> int:
    parser = argparse.ArgumentParser(description="Back up local PostgreSQL and import a remote database dump.")
    parser.add_argument("--provider", choices=("render", "aiven"), default="render")
    parser.add_argument("--source-env", default=".env")
    args = parser.parse_args()

    source_path = BACKEND / args.source_env
    source_url = dotenv_values(source_path).get("DATABASE_URL")
    local_url = dotenv_values(BACKEND / ".env.local").get("DATABASE_URL")
    if not source_url or not local_url:
        raise RuntimeError(f"Set DATABASE_URL in backend/{args.source_env} (source) and backend/.env.local (local target).")

    source_env, source_host = pg_env(source_url)
    local_env, local_host = pg_env(local_url, allow_local_socket=True)
    if args.provider == "aiven" and "PGSSLMODE" not in source_env:
        source_env["PGSSLMODE"] = "require"
    if args.provider == "render" and not source_host.endswith(".render.com"):
        raise RuntimeError(f"The source in backend/{args.source_env} is not a Render PostgreSQL host; refusing import.")
    if args.provider == "aiven" and not (source_host == "aivencloud.com" or source_host.endswith(".aivencloud.com")):
        raise RuntimeError(f"The source in backend/{args.source_env} is not an Aiven PostgreSQL host; refusing import.")
    if local_host not in {"", "localhost", "127.0.0.1", "::1"}:
        raise RuntimeError("The target in backend/.env.local must be PostgreSQL on this computer (localhost or local socket).")

    print(f"Source: {args.provider.title()} PostgreSQL")
    print("Target: local PostgreSQL")
    print("This replaces the target database. A local backup will be saved under backups/ first.")
    if input('Type IMPORT to continue: ').strip() != "IMPORT":
        print("Cancelled; no database changes made.")
        return 1

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    BACKUPS.mkdir(exist_ok=True)
    backup_path = BACKUPS / f"smartlivestock-local-before-{args.provider}-{stamp}.dump"
    temp_dump = BACKUPS / f"smartlivestock-{args.provider}-import-{stamp}.dump"

    try:
        print("Backing up local PostgreSQL...")
        run_pg("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", str(backup_path)], local_env)
        print(f"Exporting {args.provider.title()} PostgreSQL...")
        run_pg("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", str(temp_dump)], source_env)
        print(f"Restoring {args.provider.title()} data into local PostgreSQL...")
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
