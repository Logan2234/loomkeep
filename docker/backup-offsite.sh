#!/usr/bin/env bash
set -euo pipefail

# Offsite, encrypted backup of every datastore this VPS runs — not just
# Loomkeep's own database. Complements (doesn't replace) the app's own
# daily dump, which only covers the `loomkeep` database and lives on the
# same disk it's protecting. Run on the VPS host (not inside a container)
# via cron, after the app's own 3:00 dump:
#
#   0 4 * * * cd ~/loomkeep && ./docker/backup-offsite.sh >> /var/log/loomkeep-backup-offsite.log 2>&1
#
# Covers: loomkeep, and unleash, glitchtip, umami when their add-on runs
# (separate databases on the shared Postgres instance), and Quackback's own
# Postgres + MinIO uploads (a completely separate compose project, sibling
# checkout). Deliberately NOT covered: Grafana/Loki/Prometheus,
# Portainer, Caddy's TLS certs.
#
# Every dump is age-encrypted (ASCII-armored) before it leaves this host,
# for BACKUP_ENCRYPTION_PUBLIC_KEY — same key as the in-app backup, only
# the public key is ever needed here. Uploaded to Cloudflare R2 via rclone;
# a 30-day lifecycle rule on the bucket handles retention.
#
# One-time setup this script assumes is already done: `age`/`rclone`
# installed, `rclone config` has a remote named $R2_REMOTE, the R2 bucket
# exists with its lifecycle rule, and both
# this checkout's .env and the Quackback sibling checkout's .env have their
# credentials set.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOOMKEEP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QUACKBACK_DIR="${QUACKBACK_DIR:-$LOOMKEEP_DIR/../quackback}"

# Reads one key from a .env file instead of sourcing it: .env is written for
# Compose's parser, and a value Compose accepts unquoted (SMTP_FROM's
# "Name <address>") is a redirection to bash, which aborted the whole run.
env_value() {
  local key="$1" file="$2"
  { grep -m1 "^$key=" "$file" || true; } | cut -d= -f2- | tr -d '\r' |
    sed -E "s/^([\"'])(.*)\1\$/\2/"
}

LOOMKEEP_ENV="$LOOMKEEP_DIR/.env"
BACKUP_ENCRYPTION_PUBLIC_KEY="${BACKUP_ENCRYPTION_PUBLIC_KEY:-$(env_value BACKUP_ENCRYPTION_PUBLIC_KEY "$LOOMKEEP_ENV")}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(env_value POSTGRES_PASSWORD "$LOOMKEEP_ENV")}"
POSTGRES_USER="${POSTGRES_USER:-$(env_value POSTGRES_USER "$LOOMKEEP_ENV")}"
POSTGRES_DB="${POSTGRES_DB:-$(env_value POSTGRES_DB "$LOOMKEEP_ENV")}"
R2_REMOTE="${R2_REMOTE:-$(env_value R2_REMOTE "$LOOMKEEP_ENV")}"
R2_BUCKET="${R2_BUCKET:-$(env_value R2_BUCKET "$LOOMKEEP_ENV")}"
HEALTHCHECKS_OFFSITE_BACKUP_URL="${HEALTHCHECKS_OFFSITE_BACKUP_URL:-$(env_value HEALTHCHECKS_OFFSITE_BACKUP_URL "$LOOMKEEP_ENV")}"

WORKDIR="$(mktemp -d)"
# A failed run pings the check's /fail endpoint, so it alerts at once rather
# than only once the schedule's grace period has run out.
on_exit() {
  local status=$?
  rm -rf "$WORKDIR"
  if [ "$status" -ne 0 ] && [ -n "$HEALTHCHECKS_OFFSITE_BACKUP_URL" ]; then
    curl -fsS -m 10 "$HEALTHCHECKS_OFFSITE_BACKUP_URL/fail" >/dev/null || true
  fi
}
trap on_exit EXIT

: "${BACKUP_ENCRYPTION_PUBLIC_KEY:?set BACKUP_ENCRYPTION_PUBLIC_KEY in $LOOMKEEP_ENV}"
: "${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in $LOOMKEEP_ENV}"
: "${R2_BUCKET:?set R2_BUCKET (the Cloudflare R2 bucket name)}"
R2_REMOTE="${R2_REMOTE:-r2}"
POSTGRES_USER="${POSTGRES_USER:-loomkeep}"
POSTGRES_DB="${POSTGRES_DB:-loomkeep}"

DATE="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
failures=0

# Even an empty database dumps its SET preamble, well over this once
# encrypted: anything smaller means pg_dump wrote next to nothing.
MIN_DUMP_BYTES=1024

# Dumps one database from a running Postgres container, straight through
# age — the plaintext dump only ever exists in a pipe, never on disk.
dump_pg() {
  local container="$1" user="$2" password="$3" db="$4" out="$5"
  docker exec -e PGPASSWORD="$password" "$container" \
    pg_dump -U "$user" -d "$db" --no-owner --no-privileges |
    age -r "$BACKUP_ENCRYPTION_PUBLIC_KEY" -a >"$WORKDIR/$out" || return 1
  if [ "$(wc -c <"$WORKDIR/$out")" -lt "$MIN_DUMP_BYTES" ]; then
    echo "[$DATE] $db: the dump is suspiciously small." >&2
    return 1
  fi
}

# A failed dump is reported and dropped, so the others still get uploaded;
# the run then exits non-zero.
try_dump() {
  local db="$4" out="$5"
  if ! dump_pg "$@"; then
    echo "[$DATE] Failed to dump $db." >&2
    rm -f "${WORKDIR:?}/$out"
    failures=$((failures + 1))
  fi
}

# Resolved through Compose rather than a fixed name: the container is named
# after COMPOSE_PROJECT_NAME, which .env can change.
DB_CONTAINER="$(cd "$LOOMKEEP_DIR" && docker compose ps -q db)"
: "${DB_CONTAINER:?no running db service in $LOOMKEEP_DIR}"

echo "[$DATE] Dumping $POSTGRES_DB (shared Postgres)…"
try_dump "$DB_CONTAINER" "$POSTGRES_USER" "$POSTGRES_PASSWORD" "$POSTGRES_DB" "loomkeep-$DATE.sql.age"

# An add-on's database exists only once its compose file has run: one the
# instance doesn't use is skipped, not counted as a failure.
for db in unleash glitchtip umami; do
  exists="$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$DB_CONTAINER" \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '$db'")"
  if [ "$exists" = 1 ]; then
    echo "[$DATE] Dumping $db…"
    try_dump "$DB_CONTAINER" "$POSTGRES_USER" "$POSTGRES_PASSWORD" "$db" "$db-$DATE.sql.age"
  else
    echo "[$DATE] No $db database — skipping."
  fi
done

QUACKBACK_ENV="$QUACKBACK_DIR/.env"
if [ -f "$QUACKBACK_ENV" ]; then
  echo "[$DATE] Dumping Quackback (separate stack at $QUACKBACK_DIR)…"
  quackback_password="$(env_value POSTGRES_PASSWORD "$QUACKBACK_ENV")"
  quackback_user="$(env_value POSTGRES_USER "$QUACKBACK_ENV")"
  quackback_db="$(env_value POSTGRES_DB "$QUACKBACK_ENV")"
  : "${quackback_password:?set POSTGRES_PASSWORD in $QUACKBACK_ENV}"
  try_dump quackback-db "${quackback_user:-quackback}" "$quackback_password" \
    "${quackback_db:-quackback}" "quackback-$DATE.sql.age"

  # No host port on the MinIO bucket — tar the named volume directly.
  # Volume name is Compose's default "<project>_<volume>"; override
  # QUACKBACK_MINIO_VOLUME if the sibling checkout uses a non-default
  # COMPOSE_PROJECT_NAME.
  echo "[$DATE] Archiving Quackback's MinIO uploads…"
  uploads="$WORKDIR/quackback-uploads-$DATE.tar.gz.age"
  if ! docker run --rm -v "${QUACKBACK_MINIO_VOLUME:-quackback_minio_data}:/data:ro" \
    -w /data alpine tar czf - . |
    age -r "$BACKUP_ENCRYPTION_PUBLIC_KEY" >"$uploads"; then
    echo "[$DATE] Failed to archive Quackback's uploads." >&2
    rm -f "$uploads"
    failures=$((failures + 1))
  fi
else
  echo "[$DATE] No Quackback checkout at $QUACKBACK_DIR — skipping." >&2
fi

DEST="$R2_REMOTE:$R2_BUCKET/$DATE/"
echo "[$DATE] Uploading to $DEST…"
rclone copy "$WORKDIR" "$DEST"
# Compares every file with what landed in the bucket (by hash where R2 has
# one, by size otherwise): a truncated upload fails the run.
rclone check --one-way "$WORKDIR" "$DEST"

if [ "$failures" -gt 0 ]; then
  echo "[$DATE] Uploaded what succeeded; $failures dump(s) failed." >&2
  exit 1
fi

# Optional dead-man's-switch ping, silently skipped if unset.
if [ -n "$HEALTHCHECKS_OFFSITE_BACKUP_URL" ]; then
  curl -fsS -m 10 "$HEALTHCHECKS_OFFSITE_BACKUP_URL" >/dev/null || true
fi

echo "[$DATE] Done."
