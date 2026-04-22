#!/bin/bash
# shellcheck shell=bash
# ── Canvas UI Platform — HA add-on entrypoint ─────────────────────────────────

# Persistent data dir (mapped to /data by HA Supervisor)
export PORT=3100
export HOST=0.0.0.0
export DB_PATH=/data/canvas-ui.db
export DATA_DIR=/data
export IMAGES_DIR=/data/images

# Options from the add-on config UI (/data/options.json written by Supervisor)
OPTIONS=/data/options.json

if [[ -f "${OPTIONS}" ]]; then
    JWT_SECRET=$(jq -r '.jwt_secret // ""' "${OPTIONS}")
    LOG_LEVEL=$(jq -r '.log_level // "warn"' "${OPTIONS}")
else
    JWT_SECRET=""
    LOG_LEVEL="warn"
fi

# Auto-generate a JWT secret if not set
if [[ -z "${JWT_SECRET}" ]]; then
    echo "[canvas-ui] No JWT secret — generating one automatically."
    JWT_SECRET=$(cat /proc/sys/kernel/random/uuid | tr -d '-')
fi

export JWT_SECRET
export LOG_LEVEL

# HA Supervisor provides SUPERVISOR_TOKEN automatically
export HA_SUPERVISOR_TOKEN="${SUPERVISOR_TOKEN:-}"
export HA_SUPERVISOR_URL="http://supervisor/core"

# Allow the HA ingress frontend to call the API
export CORS_ORIGINS="*"

echo "[canvas-ui] Starting Canvas UI Platform server on port ${PORT}"

cd /app/server
exec node dist/index.js
