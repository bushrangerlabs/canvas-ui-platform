# BUILD_FROM must be declared before the first FROM to be usable in all stages
ARG BUILD_FROM

# ── Stage 1: Build on pinned Node 20 ─────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev

# ── Stage 2: HA base image runtime ───────────────────────────────────────────
FROM $BUILD_FROM

# Install jq + bash; copy Node 20 binary from builder to avoid apk giving us
# Node 24 which breaks the better-sqlite3 native addon (ABI mismatch)
RUN apk add --no-cache jq bash

COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --from=builder /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm

# Copy compiled server + pruned node_modules from builder
COPY --from=builder /app/server/dist /app/server/dist
COPY --from=builder /app/server/node_modules /app/server/node_modules
COPY --from=builder /app/server/package.json /app/server/package.json

# ── Add-on entrypoint (s6 service) ───────────────────────────────────────────
COPY run.sh /etc/services.d/canvas-ui/run
RUN chmod +x /etc/services.d/canvas-ui/run
