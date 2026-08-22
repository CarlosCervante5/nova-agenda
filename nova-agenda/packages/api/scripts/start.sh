#!/bin/sh
set -e

echo "[start] PORT=${PORT:-3001}"

UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"
if mkdir -p "$UPLOAD_DIR" 2>/dev/null; then
  echo "[start] Uploads dir: $UPLOAD_DIR"
else
  mkdir -p ./uploads
  echo "[start] No se pudo crear $UPLOAD_DIR — usando ./uploads. Monta un volumen en /data en Railway."
fi

if [ ! -f dist/index.js ]; then
  echo "[start] ERROR: dist/index.js not found — run npm run build first"
  exit 1
fi

echo "[start] Syncing database schema..."
npx prisma db push --skip-generate --accept-data-loss

echo "[start] Seeding database if needed..."
npx prisma db seed || echo "[start] Seed skipped or already done"

echo "[start] Starting API..."
exec node dist/index.js
