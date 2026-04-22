# ARG required by Supervisor — declared but we use node:20-alpine directly
# to avoid s6-overlay compatibility issues with better-sqlite3 native addons
ARG BUILD_FROM
ARG BUILD_ARCH=amd64

# Use pinned Node 20 Alpine directly — no s6-overlay, plain process
FROM node:20-alpine

RUN apk add --no-cache python3 make g++ jq bash

# ── Build the web editor SPA ─────────────────────────────────────────────────
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci

COPY web/tsconfig*.json ./
COPY web/vite.config.ts ./
COPY web/src ./src
COPY web/public ./public
COPY web/index.html ./
# Build into server/public/ (relative path from web/)
RUN npm run build && rm -rf node_modules

# ── Build the server ─────────────────────────────────────────────────────────
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
# Include the web build output that landed in server/public/
COPY server/public ./public
RUN npm run build && npm prune --omit=dev

COPY run.sh /run.sh
RUN chmod +x /run.sh

CMD ["/run.sh"]
