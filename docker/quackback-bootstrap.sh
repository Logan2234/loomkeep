#!/usr/bin/env bash
set -euo pipefail

# Clones (or reports the existing checkout of) Quackback — Loomkeep's
# self-hosted feedback board — as a sibling directory next to this Loomkeep
# checkout. Kept as their own unmodified deployment rather than translated
# into this repo's compose files, so it never drifts out of sync with
# upstream; see docker-compose.quackback.yml's top comment for why.
#
# This script only manages the git checkout. It never touches .env or runs
# `docker compose up` itself — those are manual steps you review, same bar
# as every other deploy action in this repo. Re-running it is a no-op if the
# checkout already exists (use `git pull` yourself to update).
#
# Usage: docker/quackback-bootstrap.sh [target-dir]
# Default target-dir: ../../quackback, i.e. a sibling of this Loomkeep
# checkout (assumes the usual `~/loomkeep`, `~/quackback` VPS layout).

REPO_URL="https://github.com/QuackbackIO/quackback.git"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-$SCRIPT_DIR/../../quackback}"

if [ -d "$TARGET_DIR/.git" ]; then
  echo "Quackback checkout already exists at $TARGET_DIR — not touching it."
  echo "To update: cd $TARGET_DIR && git pull (back up its database first — see their self-hosting docs)."
else
  git clone "$REPO_URL" "$TARGET_DIR"
  echo "Cloned Quackback into $TARGET_DIR."
fi

cat <<EOF

Next steps (manual — see $TARGET_DIR/README.md for the full self-hosting docs):
  cd $TARGET_DIR
  cp .env.prod.example .env   # fill in every value; generate secrets with: openssl rand -base64 32
  docker compose -f docker-compose.prod.yml up -d

Then, back in this Loomkeep checkout:
  - if Quackback's .env sets APP_PORT to something other than 3000, set
    QUACKBACK_APP_PORT to match in Loomkeep's own .env
  - add docker/docker-compose.quackback.yml to Loomkeep's COMPOSE_FILE
  - point feedback.<DOMAIN>'s DNS A/AAAA record at this VPS
  - redeploy Loomkeep so Caddy picks up the new site block
EOF
