ARG BUILD_FROM
FROM $BUILD_FROM

# ── System deps for better-sqlite3 native build ───────────────────────────────
RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    make \
    g++ \
    bash \
    jq

# ── Build the server ──────────────────────────────────────────────────────────
WORKDIR /app/server

# Install all deps (including devDeps — needed for tsc)
COPY server/package*.json ./
RUN npm ci

# Compile TypeScript → dist/
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# Prune devDeps to shrink the image
RUN npm prune --omit=dev

# ── Add-on entrypoint (s6 service) ───────────────────────────────────────────
COPY run.sh /etc/services.d/canvas-ui/run
RUN chmod +x /etc/services.d/canvas-ui/run
