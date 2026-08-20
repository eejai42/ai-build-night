#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Hard-coded once per project — random odd port for the Expo/Metro dev server.
APP_PORT=8731

free_port() {
  local p="$1"
  local pids
  pids=$(lsof -ti "tcp:${p}" 2>/dev/null || true)
  [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null || true
}

case "${1:-}" in
  build)
    (cd effortless-rulebook && effortless build)
    ;;
  "")
    free_port "$APP_PORT"

    echo ""
    echo "  App: http://localhost:${APP_PORT}"
    echo ""

    cd app
    npm install
    npx expo start --port "$APP_PORT"
    ;;
  *)
    echo "Usage: ./start.sh [build]" >&2
    exit 1
    ;;
esac
