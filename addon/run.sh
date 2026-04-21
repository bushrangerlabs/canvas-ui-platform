#!/usr/bin/with-contenv bashio
# shellcheck shell=bash
# ── Canvas UI Platform — HA add-on entrypoint ─────────────────────────────────

# Persistent data dir (mapped to /data by HA Supervisor)
export PORT=3100
export HOST=0.0.0.0
export DB_PATH=/data/canvas-ui.db
export DATA_DIR=/data
export IMAGES_DIR=/data/images

# Options from the add-on config UI
JWT_SECRET=$(bashio::config 'jwt_secret')
export LOG_LEVEL
LOG_LEVEL=$(bashio::config 'log_level')

# Auto-generate a JWT secret if not set
if bashio::var.is_empty "${JWT_SECRET}"; then
    bashio::log.warning "No JWT secret configured — generating one automatically."
    JWT_SECRET=$(cat /proc/sys/kernel/random/uuid | tr -d '-')
fi
export JWT_SECRET

# HA Supervisor provides SUPERVISOR_TOKEN automatically — pass it through
# so the server can call http://supervisor/core/api when needed
export HA_SUPERVISOR_TOKEN="${SUPERVISOR_TOKEN:-}"
export HA_SUPERVISOR_URL="http://supervisor/core"

# CORS: allow the HA frontend origin so the ingress-hosted web app can
# call the API without cross-origin issues
export CORS_ORIGINS="*"

bashio::log.info "Starting Canvas UI Platform server on port ${PORT}"

cd /app/server
exec node dist/index.js
