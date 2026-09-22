#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

free_port() {
  local port="$1"
  local start="$1"
  while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
    port=$((port + 1))
    if [ "$port" -gt $((start + 40)) ]; then
      echo "no free port near $start" >&2
      exit 1
    fi
  done
  echo "$port"
}

name=genesis-console-pg
if ! docker ps -a --format '{{.Names}}' | grep -qx "$name"; then
  docker run -d --name "$name" \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=genesis_console \
    -p 127.0.0.1:54329:5432 \
    postgres:16
fi
docker start "$name" >/dev/null
ready=0
for _ in $(seq 1 40); do
  if docker exec "$name" pg_isready -U postgres -d genesis_console >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "postgres did not become ready" >&2
  exit 1
fi

api_port="$(free_port "${API_PORT:-8080}")"
ui_port="$(free_port "${VITE_PORT:-5173}")"
export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:54329/genesis_console?sslmode=disable}"
export ADDR="127.0.0.1:${api_port}"
export VITE_PORT="$ui_port"
export VITE_API_ORIGIN="http://127.0.0.1:${api_port}"

echo "API http://127.0.0.1:${api_port}"
echo "UI  http://127.0.0.1:${ui_port}"

pnpm --dir web build
go run ./cmd/console &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT
cd "$root/web"
pnpm dev
