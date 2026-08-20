# Docker stack — architecture notes

Technical reference for how the compose files, Caddy, and the optional
add-ons fit together. For setup instructions (how to actually stand this up),
see the root [README.md](../README.md) — this file is the "why it's built
this way" companion for whoever edits these configs.

## Layout

Every `docker-compose.*.yml`, the `Caddyfile`, and the add-on config dirs
(`observability/`, `authelia/`, `homepage/`, `umami/`, `flags/`) live under `docker/`, not the
repo root — kept together as a unit so their relative paths to each other
never had to change. `docker-compose.yml`'s `api`/`web` services reference
pre-built `image:`s rather than building — see "Images" below. Both
Dockerfiles copy _all_ workspace `package.json` manifests plus
`tsconfig.base.json` before `pnpm install --frozen-lockfile` (a frozen
install validates every importer in the lockfile). The api image runs
`prisma migrate deploy` at boot; the web runtime image ships only the
self-contained adapter-node `build/` output.

## Images

`apps/api/Dockerfile` and `apps/web/Dockerfile` are built and pushed to
GHCR (`ghcr.io/logan2234/loomkeep-{api,web}`) by the `docker-push` job in
`.github/workflows/ci.yml`, on every push to `main` — tagged both `latest`
and the commit's short SHA (the api build also gets `GIT_SHA` as a build
arg there, baked into the image for the Homepage "Version" widget).
`docker-compose.yml` pulls those images via `${IMAGE_TAG:-latest}` instead
of building locally; nothing under `docker/` runs `docker build`/`docker
compose build` anymore. `context: ..` still shows up in `ci.yml`'s
`build-push-action` steps and points back up at the monorepo root, since
both Dockerfiles expect their build context to start there.

## Deploy

`.github/workflows/deploy.yml` auto-redeploys on every successful CI run on
`main` via `docker compose pull && docker compose up -d` (no `-f` flags),
with `IMAGE_TAG` pinned to that commit's short SHA so it pulls the exact
images CI just built rather than whatever `latest` happens to point at —
which override files get combined comes from `COMPOSE_FILE` in the VPS's
own `.env` (Compose reads this itself), not from the workflow. Adding a new
optional `docker-compose.<addon>.yml` that should run continuously in
production means updating that `COMPOSE_FILE` line (see `.env.example`), not
`deploy.yml`.

Docker log rotation (`max-size: 10m`, `max-file: 5`) is set per service in
`docker-compose.yml`/`docker-compose.prod.yml` (duplicated by hand in the
override — Compose doesn't merge YAML anchors across `-f` files). App-level
logging conventions (structured JSON, redaction, exception filter) are
documented in the root `CLAUDE.md`.

## Cloudflare, real client IPs & bot protection

Not a compose override — a DNS-level choice (proxy the domain through
Cloudflare or not) plus two small pieces of app code. See root README
"Cloudflare" and "Bot protection" for the dashboard setup.

`TRUST_PROXY` (`apps/api/src/main.ts`, passed to `FastifyAdapter`) gates
whether the API trusts `X-Forwarded-For` for `request.ip`/`@Ip()`/
`ThrottlerGuard`'s per-IP tracking. Off by default — trusting it
unconditionally would let anyone hitting the API directly spoof their own
IP via that header. `docker-compose.prod.yml` sets it to `"true"` because
Caddy is unconditionally the one hop in front of the API in that override;
the base `docker-compose.yml` (self-host, no Caddy in front) leaves it
off. This matters more once Cloudflare is proxying too: Caddy's own
`X-Forwarded-For` chain already carries the real visitor IP by the time it
reaches the API (Cloudflare sets it correctly upstream), so trusting
Caddy's one hop is enough — no Cloudflare-specific header handling needed
in app code.

`TurnstileService` (`apps/api/src/auth/turnstile.service.ts`) verifies the
register form's Cloudflare Turnstile token server-side via Cloudflare's
`siteverify` API, called from `AuthService.register()` before any DB
write. Fails closed on a network/API error (a Cloudflare hiccup shouldn't
silently disable bot protection) but is a pure no-op — always passes —
when `TURNSTILE_SECRET_KEY` is unset, same "empty disables the feature"
convention as everywhere else. The widget itself
(`apps/web/src/lib/components/Turnstile.svelte`) loads Cloudflare's script
directly rather than an npm package (their own recommended integration
path) and only renders when `PUBLIC_TURNSTILE_SITE_KEY` is set.

## Maintenance mode

Toggled by the presence of a marker file, not an env var or a Caddy
reload/redeploy — `Caddyfile`'s `@maintenance file /flags/maintenance`
matcher is checked live on every request. When present, every request gets
a themed 503 page (`maintenance/index.html`) instead of hitting `api`/`web`;
this also means it keeps working if the actual outage is the API or DB
being down, unlike a flag stored in the app's own database. Only wired into
`docker-compose.prod.yml` (self-host's base compose doesn't run Caddy at
all — see "Layout" above).

The flag lives at `docker/caddy-flags/maintenance`, bind-mounted (not a
named volume) so it's a plain path on the VPS an admin can toggle over SSH,
no Docker commands needed:

```sh
touch docker/caddy-flags/maintenance   # on
rm docker/caddy-flags/maintenance      # off
```

## Backups

Two layers, both encrypted for the same key (see below), neither depends on
the other:

**Local, in-app** — `apps/api/src/admin/backup.service.ts` dumps the
`loomkeep` database daily at 3:00 (also triggerable on demand from
`/admin/backup`), keeps the 7 most recent on `BACKUP_DIR` (a dedicated
volume, separate from Postgres's own so a corrupt DB doesn't take its
backups down with it). Every dump is age-encrypted before it touches disk
(LK-C20) — the admin page can only offer the encrypted file for download,
never plaintext; restoring means decrypting it yourself first (see below),
then uploading the resulting `.sql`.

**Offsite, host-level** — `docker/backup-offsite.sh`, run via VPS cron (not
a container), covers everything the in-app one doesn't: `unleash` and
`glitchtip` (separate databases on the same shared Postgres instance —
`umami` is deliberately excluded, see `docker-compose.umami.yml`'s own
comment, its data is low-stakes and re-collectable) and Quackback's entire
separate stack (its own Postgres + MinIO uploads). Ships everything,
encrypted, to Cloudflare R2 via `rclone`. Read the script's own header
comment for exactly what it does — this section only covers one-time setup.

### The encryption key

Both layers encrypt for the same [age](https://github.com/FiloSottile/age)
public key (`BACKUP_ENCRYPTION_PUBLIC_KEY` in `.env`) — asymmetric on
purpose: this VPS only ever needs the _public_ key to produce backups, and
can never decrypt one back. The private key must live somewhere that isn't
this VPS (a password manager, an offline copy) — generate it on your own
machine, **not** on the server:

```sh
age-keygen -o loomkeep-backup-key.txt
# Public key: age1... — paste this into BACKUP_ENCRYPTION_PUBLIC_KEY in .env
```

Save `loomkeep-backup-key.txt` (the private key) somewhere durable and
secret, then delete it from wherever you ran this command. Losing it makes
every backup taken with the matching public key permanently unrecoverable
— there's no recovery path around that, by design.

To restore: `age -d -o dump.sql backup-file.sql.age` (age prompts for the
private key file), then feed `dump.sql` into `/admin/backup`'s restore flow
(in-app dumps) or `psql` directly (offsite dumps).

### Offsite setup (`docker/backup-offsite.sh`)

One-time, on the VPS:

1. **Cloudflare R2 bucket**: dashboard → R2 → Create bucket. Add a
   lifecycle rule expiring objects after 30 days (Object lifecycle rules →
   Add rule) — this is what bounds retention, the script itself never
   prunes.
2. **API token**: R2 → Manage API tokens → Create token, scoped to that one
   bucket only (not account-wide). Note the Access Key ID, Secret Access
   Key, and your account's S3 endpoint (`https://<account-id>.r2.cloudflarestorage.com`).
3. **Install `age` and [`rclone`](https://rclone.org/install/)** on the VPS
   host, then configure the remote: `rclone config` → `n` (new remote) →
   name it `r2` (or set `R2_REMOTE` in `.env` to whatever you pick) →
   provider `Cloudflare R2` → paste the credentials from step 2.
4. **Set `R2_BUCKET`** (and `BACKUP_ENCRYPTION_PUBLIC_KEY` if not already)
   in `.env`.
5. **Cron** — `crontab -e`, add (after the in-app dump's own 3:00 run):

   ```
   0 4 * * * cd ~/loomkeep && ./docker/backup-offsite.sh >> /var/log/loomkeep-backup-offsite.log 2>&1
   ```

6. Optional: a [Healthchecks.io](https://healthchecks.io) check, its ping
   URL in `HEALTHCHECKS_OFFSITE_BACKUP_URL` — same dead-man's-switch
   pattern as the app's own jobs (see "Job monitoring" below).

**Test the restore path at least once** — an offsite backup nobody has ever
decrypted is a hypothesis, not a guarantee. Pull one file down
(`rclone copy r2:<bucket>/<date>/loomkeep-*.sql.age .`), decrypt it, and
confirm it actually loads into a scratch Postgres.

## Image vulnerability scanning (Trivy)

`.github/workflows/trivy.yml` — separate from `ci.yml`'s own
`docker-build-images` job (which only validates the Dockerfiles still build) and
from `codeql.yml` (static analysis of this repo's own source). Trivy scans
the _built images_ for known CVEs in OS packages and dependencies baked
into `node:26-alpine`, catching vulnerabilities Dependabot's
version-bump-only Docker ecosystem support can't see. Same triggers and
advisory-only philosophy as `codeql.yml` (push/PR to `main` + a Monday
cron so a new CVE in an unchanged base image still gets caught; results go
to the Security tab as SARIF, never fail the build).

## Metrics & log search (`docker-compose.observability.yml`)

Optional override adding Grafana + Loki + Promtail (logs) and Prometheus +
node_exporter + postgres_exporter + cAdvisor (host/DB/per-container metrics)
— config in `docker/observability/`. Promtail auto-discovers every container
via the Docker socket and ships its already-rotated json-file logs into
Loki; both Loki and Prometheus are pre-provisioned as Grafana data sources
(`docker/observability/grafana-datasources.yaml`). Grafana is reachable both
publicly at `grafana.<DOMAIN>` via Caddy (`docker/observability/grafana.caddy`,
gated by Grafana's own login only, no basic auth) and via `127.0.0.1:3001`
as an SSH-tunnel fallback — see root README "Logs and monitoring". Promtail
is deprecated upstream (merged into Grafana Alloy); a future replacement
would likely take node_exporter/postgres_exporter's job too at the same
time. cAdvisor has no public port, scraped by Prometheus like the other
exporters.

Caddy itself (`docker/Caddyfile`) contributes to this without an extra
container: `encode gzip zstd` compresses responses, `log { output stdout;
format json }` puts its access log in the same json-file/Promtail pipeline
as every app container, and a global `admin 0.0.0.0:2019` + `metrics` option
exposes a Prometheus `/metrics` endpoint scraped as the `caddy` job in
`docker/observability/prometheus.yml` — bound to the compose network only,
not published to the host, same trust level as `db`. It also sends baseline
security headers (HSTS with `includeSubDomains`, `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`) on the main site block.
`docker/www-redirect.caddy` (mounted only by `docker-compose.prod.yml`)
redirects `www.<DOMAIN>` to the apex; it's a dedicated site block matching
only that one hostname so it can't shadow subdomain blocks like
`grafana.<DOMAIN>`.

## Job monitoring (Healthchecks.io)

Not a compose override — no container to run. `JobRunService.record()`
(`apps/api/src/jobs/job-run.service.ts`) already wraps every `@Cron()` job
and persists success/failure to the `JobRun` table for the admin "Jobs"
page; `ping()` on the same class additionally pings a per-job
Healthchecks.io URL (`JOB_HEALTHCHECK_ENV` in `job-keys.ts` maps each
`JobKey` to its env var) on both outcomes — success to the plain URL,
failure to its `/fail` suffix. The two mechanisms are complementary, not
redundant: `JobRun` only gets written when the job actually runs, so it
can't see a job that silently stopped firing at all — that's exactly the
gap Healthchecks.io's own "no ping arrived in time" alerting covers, since
the _absence_ of a ping is itself the signal. Best-effort by design: a
`fetch()` failure to Healthchecks.io is swallowed, never allowed to affect
the job's own recorded outcome. See root README "Job monitoring" for the
account setup and env vars.

When the observability override is also running, `prometheus.yml` has a
`healthchecks` scrape job pulling Healthchecks.io's own per-project metrics
endpoint (`hc_check_up` per check) — native Grafana history/alerting on job
health instead of only the Homepage tile. Uses the Bearer-token variant of
their endpoint specifically so the read-only API key never sits in this
committed file: `credentials_file` points at
`docker/observability/healthchecks_token`, a gitignored real file (copied
from `healthchecks_token.example`), same convention as Authelia's secrets
below. The project UUID itself isn't secret (useless without the key) and
is inline in `prometheus.yml`, consistent with `docker/homepage/*.yaml`
already hardcoding this instance's own domain rather than being templated.

## Error tracking (`docker-compose.glitchtip.yml`)

GlitchTip — a self-hosted, Sentry-API-compatible error tracker, run in
`SERVER_ROLE: all_in_one` mode. Shares the app's own Postgres instance (a
separate `glitchtip` database, see `observability/init-glitchtip-db.sql`)
rather than running a dedicated container — accepted trade-off versus full
isolation from Loki/Grafana's own storage: a Postgres outage now also takes
GlitchTip down with it, right when you'd most want it to still alert. Still
keeps its own dedicated Valkey (different technology, nothing to gain by
sharing that). Reachable at `errors.<DOMAIN>`, same
public-with-own-login-no-basic-auth pattern as Grafana/Portainer. Email
alerts (new-error/regression notifications) are opt-in via
`GLITCHTIP_EMAIL_URL` — not auto-derived from the app's own SMTP config
because GlitchTip's `EMAIL_URL` is parsed as a plain URL and the app's Brevo
`SMTP_USER` contains a literal `@` that breaks that unescaped.

The app reports to it via the standard Sentry SDKs (GlitchTip is
Sentry-API-compatible) — `@sentry/node` in `apps/api/src/instrument.ts`
(imported first in `main.ts`, `Sentry.captureException` called from
`AllExceptionsFilter` only for 5xx, matching its warn/error log split) and
`@sentry/sveltekit` in `apps/web/src/hooks.client.ts`. Both are gated on
their DSN env var (`GLITCHTIP_API_DSN` / `PUBLIC_GLITCHTIP_WEB_DSN`) being
set, which only happens in the production Docker deployment — empty
disables reporting, same convention as every other optional integration.
Errors only: no tracing on the web side, no session replay (GlitchTip drops
those events silently), no source-map upload yet (`@sentry/cli`'s
postinstall is explicitly declined in `pnpm-workspace.yaml`'s
`allowBuilds`).

`docker-compose.portainer.yml` adds a Docker management UI at
`portainer.<DOMAIN>` (same pattern, no dedicated storage needed).

## Feature flags (`docker-compose.unleash.yml`)

[Unleash](https://www.getunleash.io/) — a self-hosted, open-source feature
flag service. Shares the app's own Postgres instance (a separate `unleash`
database, see `flags/init-unleash-db.sql`), same reasoning as Umami:
avoids a second Postgres process on a single-VPS deployment, and unlike
GlitchTip/Loki this isn't watching the app from outside, so there's no
failure-domain reason to isolate it either. Reachable at `flags.<DOMAIN>`,
same public-with-own-login-no-basic-auth pattern as Grafana/Portainer/
GlitchTip — except Unleash's open-source edition has no OIDC support
(enterprise-only), so it can't go behind Authelia as true SSO the way those
three do.

The api authenticates to Unleash's client API over the internal Docker
network (`UNLEASH_API_URL`/`UNLEASH_API_TOKEN`, this override's partial
override of the `api` service), never through the public subdomain — that
subdomain only serves the admin UI.

## User feedback board (`docker-compose.quackback.yml`)

[Quackback](https://quackback.io) — an open-source, self-hostable
alternative to Canny/UserVoice: feedback boards (bugs and feature ideas as
separate boards), voting, a roadmap view and a changelog. Unlike every other
add-on in this file, it is **not** reimplemented as Loomkeep-managed
services. An earlier version of this override tried to translate their
`docker-compose.prod.yml` (custom Postgres build with pg_cron/pgvector,
Dragonfly with specific BullMQ-required flags, MinIO + a bucket-init
service) into Loomkeep-prefixed services — a parallel copy that would
silently drift the moment Quackback's own stack changes upstream, with
nothing here to signal it happened.

Instead, Quackback runs as its own completely separate, unmodified
deployment, bootstrapped with `docker/quackback-bootstrap.sh` (clones their
repo as a sibling checkout — `~/quackback` next to `~/loomkeep` on the VPS —
and prints the manual `.env`/`docker compose up` steps from their own
self-hosting docs; never runs `docker compose` itself). This override's only
job is wiring Caddy to it: `feedback.<DOMAIN>` reverse-proxies to
`host.docker.internal:${QUACKBACK_APP_PORT}` — the port Quackback's own
compose project published on the VPS host, reachable via `extra_hosts:
host.docker.internal:host-gateway` regardless of which compose project
started it, no shared Docker network required. Same
public-with-own-login-no-basic-auth pattern as Grafana/Portainer/GlitchTip —
login is Quackback's own email-OTP, sent through whatever SMTP creds you put
in _its_ `.env` (separate from Loomkeep's `SMTP_*`).

Upgrading Quackback is entirely on their side: `cd ~/quackback && git pull
&& docker compose -f docker-compose.prod.yml up -d --build`. Nothing to
touch in this repo unless `QUACKBACK_APP_PORT` itself changes.

## Single sign-on (`docker-compose.authelia.yml`)

[Authelia](https://www.authelia.com/) — chosen over Authentik specifically
for its footprint (single binary + SQLite, no dedicated Postgres/Redis;
Authentik would've meant a _fourth_ dedicated Postgres instance in this
stack, disproportionate for a single-user setup).

Two integration modes: Grafana/GlitchTip/Portainer use real OIDC (the app
redirects to Authelia and back — true SSO, no re-login visiting a second
app), while Homepage (`docker-compose.homepage.yml`, chosen over Dashy for
being lighter and matching this repo's committed-YAML-config convention
rather than an in-UI editor) has no login of its own and is gated via Caddy
`forward_auth` instead (`docker/homepage/homepage.caddy`). Grafana's OIDC is
fully env-var driven (`docker-compose.observability.yml`); GlitchTip and
Portainer don't support that and need a one-time manual step in their own
admin UI after Authelia exists — see root README "Single sign-on" for the
exact values.

Real secrets (session/storage/OIDC HMAC secrets, the RSA JWKS signing key,
the user database) live in `docker/authelia/configuration.yml` and
`docker/authelia/users_database.yml` — gitignored, copied from `*.example`
templates, same convention as `.env`; OIDC client secrets specifically
**must** be file-based (Authelia doesn't support environment variables for
values inside config lists, confirmed via its own docs), which is why this
uses gitignored real files rather than `.env` interpolation like everything
else in this repo. **Authelia hard-fails to start without working SMTP** (a
startup health check, not an optional degrade-gracefully feature like the
rest of this app's SMTP integration) — reuses the same Brevo credentials as
`SMTP_USER`/`SMTP_PASS`.

## Homepage (`docker-compose.homepage.yml`)

Homepage's tiles (`docker/homepage/services.yaml`) use live widgets where
one exists (Grafana, Portainer — both have native Homepage widgets) and a
hand-rolled `customapi` call against GlitchTip's own Sentry-compatible
issues API where it doesn't (no native GlitchTip widget in Homepage). No
Docker socket mounted for Homepage — per-container stats were deliberately
skipped in favor of Grafana/Prometheus/cAdvisor, which already cover that in
more depth; a second Docker-access path would've been redundant. Widget API
keys flow in as `HOMEPAGE_VAR_*` env vars (Homepage's own
`{{HOMEPAGE_VAR_X}}` templating mechanism), not baked into the committed
YAML.
