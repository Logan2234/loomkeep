#!/usr/bin/env bash
# Runs on the VPS, from the checkout deploy.yml has just reset to the commit
# CI validated (DEPLOY_SHA). Which compose files run comes from COMPOSE_FILE
# in the VPS's own .env, not from here.
#
# Safety net: a dump of the database before the new images start (their
# api runs `prisma migrate deploy` at boot), and when the new containers
# never become healthy, a return to the previous images — unless a
# migration already ran, since old code on a newer schema can be worse than
# a failed deploy. Either way the job fails, so ntfy alerts.
set -euo pipefail

: "${DEPLOY_SHA:?DEPLOY_SHA must be set}"

set -a
# shellcheck disable=SC1091
source .env
set +a

DUMP_DIR="$HOME/loomkeep-predeploy"
DB_USER="${POSTGRES_USER:-loomkeep}"
DB_NAME="${POSTGRES_DB:-loomkeep}"

# The tag the running api uses (empty on a first deploy).
previous_tag=""
if api=$(docker compose ps -q api) && [ -n "$api" ]; then
  previous_tag=$(docker inspect -f '{{.Config.Image}}' "$api" | sed -n 's/.*://p')
fi

applied_migrations() {
  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL" \
    2>/dev/null || echo 0
}

# Encrypted for the same age key as every other backup; the plaintext only
# exists in the pipe. The last 5 are kept.
mkdir -p "$DUMP_DIR"
dump="$DUMP_DIR/predeploy-$(date -u +%Y%m%dT%H%M%SZ)-${DEPLOY_SHA:0:12}.sql.age"
if [ -n "$previous_tag" ]; then
  docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges |
    age -r "$BACKUP_ENCRYPTION_PUBLIC_KEY" >"$dump"
  echo "Pre-deploy dump: $dump"
  ls -1t "$DUMP_DIR"/predeploy-*.sql.age | tail -n +6 | xargs -r rm --
fi
migrations_before=$(applied_migrations)

# Pins api/web to the images CI pushed for this commit (ci.yml's
# docker-push), not the floating `latest`. Also feeds the Homepage
# "Version" widget, which reads GIT_SHA baked into the api image.
export IMAGE_TAG="${DEPLOY_SHA:0:12}"
docker compose pull

# "port is already allocated" right after a previous deploy is a transient
# Docker race: retried a few times. --remove-orphans drops services removed
# from COMPOSE_FILE.
start() {
  for attempt in 1 2 3; do
    if docker compose up -d --remove-orphans; then
      return 0
    fi
    echo "docker compose up -d failed (attempt $attempt/3), retrying in 5s..."
    sleep 5
  done
  return 1
}

# `up -d` returns as soon as containers start: an api stuck on a failed
# migration would hide behind it. Waits for docker-compose.yml's
# healthchecks, up to 5 minutes per service.
healthy() {
  for service in api web; do
    container=$(docker compose ps -q "$service")
    for attempt in $(seq 1 60); do
      status=$(docker inspect -f '{{.State.Health.Status}}' "$container")
      [ "$status" = healthy ] && break
      if [ "$attempt" = 60 ]; then
        echo "$service is still $status after 5 minutes" >&2
        docker compose logs --tail=80 "$service" >&2
        return 1
      fi
      sleep 5
    done
  done
}

if start && healthy; then
  # A day of unused images keeps the previous pair for a manual rollback;
  # a week of them, with several deploys a day, filled the disk. Images in
  # use are never removed.
  docker image prune -a -f --filter "until=24h"
  docker builder prune -f --filter "until=24h"
  exit 0
fi

echo "::error::The ${IMAGE_TAG} images didn't come up healthy." >&2
if [ -z "$previous_tag" ]; then
  echo "No previous images to return to." >&2
elif [ "$(applied_migrations)" != "$migrations_before" ]; then
  echo "A migration ran, so the previous images stay stopped: old code on the" >&2
  echo "new schema could corrupt data. Restore $dump or fix forward." >&2
else
  echo "No migration ran: returning to the previous images ($previous_tag)." >&2
  export IMAGE_TAG="$previous_tag"
  start && healthy && echo "Back on $previous_tag." >&2
fi
exit 1
