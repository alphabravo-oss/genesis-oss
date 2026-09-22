#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p .local
if [ ! -s .local/postgres-password ]; then openssl rand -hex 32 > .local/postgres-password; fi
if [ ! -s .local/console-password ]; then openssl rand -hex 32 > .local/console-password; fi
if [ ! -s .local/database-url ]; then
  printf 'postgres://genesis:%s@postgres:5432/genesis_console?sslmode=disable\n' "$(cat .local/postgres-password)" > .local/database-url
fi
# Compose file-backed secrets retain source permissions; the container runs as 65532.
# The containing directory stays owner-only on the host.
chmod 700 .local
chmod 644 .local/postgres-password .local/console-password .local/database-url
args=(-f compose.yaml)
if [ -n "${GENESIS_KUBECONFIG:-}" ]; then
  if [ "$GENESIS_KUBECONFIG" != "$PWD/.local/kubeconfig-container" ]; then
    cp "$GENESIS_KUBECONFIG" .local/kubeconfig-container
  fi
  chmod 644 .local/kubeconfig-container
  export GENESIS_KUBECONFIG="$PWD/.local/kubeconfig-container"
  args+=(-f compose.cluster.yaml)
fi
docker compose "${args[@]}" up --build -d --wait "$@"
if ! curl --fail --silent --show-error --max-time 5 -D - "http://127.0.0.1:${GENESIS_PORT:-8090}/healthz" | grep -i '^X-Genesis-Console: 1' >/dev/null; then
  echo 'The host port is not reaching Genesis Console. Retry with GENESIS_PORT set to a free port.' >&2
  exit 1
fi
printf 'Console: http://127.0.0.1:%s (user admin)\nPassword is in %s/.local/console-password\n' "${GENESIS_PORT:-8090}" "$PWD"
