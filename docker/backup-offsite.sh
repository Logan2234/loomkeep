#!/usr/bin/env bash
set -euo pipefail

# Offsite, encrypted backup of every datastore this VPS runs — not just
# Loomkeep's own database. Complements (doesn't replace) the app's own daily
# dump: that one only covers the `loomkeep` database, lives on the same disk
# it's protecting, and is kept unencrypted-at-rest only as long as
# BACKUP_ENCRYPTION_PUBLIC_KEY is set (see BackupService, LK-C20). Run this
# script on the VPS host (not inside a container) via cron, e.g. daily at
# 4:00 — after the app's own 3:00 dump:
#
#   0 4 * * * cd ~/loomkeep && ./docker/backup-offsite.sh >> /var/log/loomkeep-backup-offsite.log 2>&1
#
# Covers:
#   - loomkeep, unleash, glitchtip, umami — all separate databases on the
#     same shared Postgres instance (docker-compose.yml's `db` service).
#   - Quackback's own Postgres + MinIO uploads — a completely separate
#     Compose project (own docker-compose.prod.yml, sibling checkout — see
#     docker-compose.quackback.yml's own comment for why it's not
#     reimplemented here).
# Deliberately NOT covered (see docker/README.md "Backups" for the reasoning
# already accepted for Umami, extended here to observability/ops state that
# carries no user data and is trivially recreated): Grafana/Loki/Prometheus,
# Portainer, Caddy's TLS certs.
#
# Every dump is age-encrypted (ASCII-armored) before it leaves this host,
# for BACKUP_ENCRYPTION_PUBLIC_KEY — same key as the in-app backup, same
# guarantee: only the *public* key is ever needed here, decrypting requires
# the private key, which must live somewhere that isn't this VPS. Uploaded
# to Cloudflare R2 via rclone; a 30-day lifecycle rule on the bucket handles
# retention (nothing to prune here — see docker/README.md for the rule).
#
# One-time setup this script assumes is already done (see docker/README.md
# "Offsite backups"):
#   - `age` and `rclone` installed on this host
#   - `rclone config` has a remote named $R2_REMOTE pointing at your R2
#     account (R2's own dashboard gives you the S3-compatible endpoint +
#     access key + secret to feed it)
#   - the R2 bucket exists, with a 30-day expiry lifecycle rule
#   - this Loomkeep checkout's own .env has POSTGRES_USER/POSTGRES_PASSWORD
#     and BACKUP_ENCRYPTION_PUBLIC_KEY set (same file the app itself reads)
#   - the Quackback sibling checkout's own .env has its POSTGRES_*/MINIO_*
#     credentials (this script reads that file directly — nothing
#     duplicated here)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOOMKEEP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QUACKBACK_DIR="${QUACKBACK_DIR:-$LOOMKEEP_DIR/../quackback}"

R2_REMOTE="${R2_REMOTE:-r2}"
R2_BUCKET="${R2_BUCKET:?set R2_BUCKET (the Cloudflare R2 bucket name)}"

# Loomkeep's own root .env — same file docker compose reads (POSTGRES_USER,
# POSTGRES_PASSWORD, BACKUP_ENCRYPTION_PUBLIC_KEY).
set -a
# shellcheck disable=SC1091
source "$LOOMKEEP_DIR/.env"
set +a
: "${BACKUP_ENCRYPTION_PUBLIC_KEY:?set BACKUP_ENCRYPTION_PUBLIC_KEY in $LOOMKEEP_DIR/.env}"
: "${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in $LOOMKEEP_DIR/.env}"
POSTGRES_USER="${POSTGRES_USER:-loomkeep}"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
DATE="$(date -u +%Y-%m-%dT%H-%M-%SZ)"

# Dumps one database from a running Postgres container, straight through
# age — the plaintext dump only ever exists in a pipe, never on disk.
dump_pg() {
  local container="$1" user="$2" password="$3" db="$4" out="$5"
  docker exec -e PGPASSWORD="$password" "$container" \
    pg_dump -U "$user" -d "$db" --no-owner --no-privileges |
    age -r "$BACKUP_ENCRYPTION_PUBLIC_KEY" -a >"$WORKDIR/$out"
}

echo "[$DATE] Dumping loomkeep, unleash, glitchtip, umami (shared Postgres)…"
dump_pg db "$POSTGRES_USER" "$POSTGRES_PASSWORD" loomkeep "loomkeep-$DATE.sql.age"
dump_pg db "$POSTGRES_USER" "$POSTGRES_PASSWORD" unleash "unleash-$DATE.sql.age"
dump_pg db "$POSTGRES_USER" "$POSTGRES_PASSWORD" glitchtip "glitchtip-$DATE.sql.age"
dump_pg db "$POSTGRES_USER" "$POSTGRES_PASSWORD" umami "umami-$DATE.sql.age"

if [ -f "$QUACKBACK_DIR/.env" ]; then
  echo "[$DATE] Dumping Quackback (separate stack at $QUACKBACK_DIR)…"
  set -a
  # shellcheck disable=SC1091
  source "$QUACKBACK_DIR/.env"
  set +a
  : "${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in $QUACKBACK_DIR/.env}"
  dump_pg quackback-db "${POSTGRES_USER:-quackback}" "$POSTGRES_PASSWORD" \
    "${POSTGRES_DB:-quackback}" "quackback-$DATE.sql.age"

  # MinIO's upload bucket has no host port (internal-only, see
  # docker-compose.prod.yml) — tar the named volume directly instead of
  # talking to its S3 API, so this doesn't depend on network reachability
  # from the host. Volume name is Compose's default
  # "<project>_<volume>"; override QUACKBACK_MINIO_VOLUME if the sibling
  # checkout uses a non-default COMPOSE_PROJECT_NAME.
  echo "[$DATE] Archiving Quackback's MinIO uploads…"
  docker run --rm -v "${QUACKBACK_MINIO_VOLUME:-quackback_minio_data}:/data:ro" \
    -w /data alpine tar czf - . |
    age -r "$BACKUP_ENCRYPTION_PUBLIC_KEY" >"$WORKDIR/quackback-uploads-$DATE.tar.gz.age"
else
  echo "[$DATE] No Quackback checkout at $QUACKBACK_DIR — skipping." >&2
fi

echo "[$DATE] Uploading to $R2_REMOTE:$R2_BUCKET/$DATE/…"
rclone copy "$WORKDIR" "$R2_REMOTE:$R2_BUCKET/$DATE/"

# Optional dead-man's-switch ping, same pattern as the app's own scheduled
# jobs (src/jobs/job-run.service.ts) — silently skipped if unset.
if [ -n "${HEALTHCHECKS_OFFSITE_BACKUP_URL:-}" ]; then
  curl -fsS -m 10 "$HEALTHCHECKS_OFFSITE_BACKUP_URL" >/dev/null || true
fi

echo "[$DATE] Done."
