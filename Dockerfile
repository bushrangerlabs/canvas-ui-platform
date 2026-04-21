ARG BUILD_FROM
FROM $BUILD_FROM

# ── System deps for better-sqlite3 native build ───────────────────────────────
RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    make \
    g++ \
    bash

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

# ── Add-on entrypoint ─────────────────────────────────────────────────────────
COPY run.sh /run.sh
RUN chmod +x /run.sh

CMD ["/run.sh"]
