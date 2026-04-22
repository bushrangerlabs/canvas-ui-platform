#!/usr/bin/env bash
# release.sh <version> "Release notes"
# Bumps config.yaml, builds web, commits, tags, and pushes.
set -euo pipefail

VERSION="${1:-}"
NOTES="${2:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: ./release.sh <version> \"Release notes\""
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── 1. Bump version in config.yaml ────────────────────────────────────────────
sed -i "s/^version: .*/version: \"${VERSION}\"/" "$REPO_ROOT/config.yaml"
echo "✓ config.yaml → $VERSION"

# ── 2. Build web ──────────────────────────────────────────────────────────────
echo "Building web…"
cd "$REPO_ROOT/web"
npm run build
cd "$REPO_ROOT"
echo "✓ web built"

# ── 3. Commit, tag, push ─────────────────────────────────────────────────────
git add -A
git commit -m "chore: release v${VERSION}${NOTES:+

${NOTES}}"
git tag "v${VERSION}"
git push origin main --tags
echo "✓ pushed v${VERSION}"
