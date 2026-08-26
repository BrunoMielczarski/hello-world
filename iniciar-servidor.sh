#!/usr/bin/env bash
# Inicia o servidor Protus (Linux/macOS).
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale em https://nodejs.org e rode novamente."
  exit 1
fi

PORT="${PORT:-4040}" exec node server/server.js
