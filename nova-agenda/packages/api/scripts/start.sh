#!/bin/sh
set -e

echo "[start] PORT=${PORT:-3001}"

if [ ! -f dist/index.js ]; then
  echo "[start] ERROR: dist/index.js not found — run npm run build first"
  exit 1
fi

echo "[start] Syncing database schema..."
npx prisma db push --skip-generate

echo "[start] Starting API..."
exec node dist/index.js
