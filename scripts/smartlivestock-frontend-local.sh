#!/usr/bin/env bash
set -e
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/frontend"
export NEXT_PUBLIC_API_URL=http://localhost:8000
export NEXT_PUBLIC_LOCAL_API_URL=http://localhost:8000
export NEXT_PUBLIC_RENDER_API_URL=https://smartlivestock-xkx4.onrender.com
export NEXT_PUBLIC_FALLBACK_API_URL=http://localhost:8000
export NEXT_PUBLIC_ENABLE_CLOUD_FALLBACK=false
exec npm run dev -- --webpack
