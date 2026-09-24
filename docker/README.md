# Docker stack — architecture notes

Technical reference for how the compose files, Caddy, and the optional
add-ons fit together — the decisions that aren't visible just from reading
one file. For setup instructions, see the root [README.md](../README.md).
Line-level details (which env var does what, why a value is what it is)
live as comments next to that line in the relevant `docker-compose.*.yml`
or `.caddy` file, not here — this file only covers what spans files.

## Layout

Every `docker-compose.*.yml`, the `Caddyfile`, and the add-on config dirs
live under `docker/`, not the repo root. `docker-compose.yml`'s `api`/`web`
services reference pre-built `image:`s rather than building — see "Images".

## Self-hosting & legal responsibility

Standing up this stack for other people (not just running it locally for
yourself) makes you a data controller under the GDPR for whatever personal
data your instance processes — Loomkeep's own hosted-instance legal notices
and privacy policy (`apps/web/src/routes/legal/`) cover Logan's VPS only.
You need your own mentions légales and privacy policy; the privacy policy's
§20 ("Instances auto-hébergées") is a starting point to adapt.

## Images & deploy

`apps/api/Dockerfile` and `apps/web/Dockerfile` are built and pushed to GHCR
by the `docker-push` job in `.github/workflows/ci.yml` on every push to
`main`. `.github/workflows/deploy.yml` then auto-redeploys on every
successful CI run via `docker compose pull && docker compose up -d`, with
`IMAGE_TAG` pinned to that commit's SHA. Which override files get combined
comes from `COMPOSE_FILE` in the VPS's own `.env`, not the workflow — adding
a new optional `docker-compose.<addon>.yml` that should run continuously in
production means updating that line (see `.env.example`).

## Shared Postgres for add-ons

GlitchTip, Unleash, and Umami each get their own database on the app's
existing `db` service instead of a dedicated container — one fewer Postgres
process to run on a single-VPS deployment. Each database is created
automatically only on a brand-new volume (see each add-on's own
`init-*-db.sql`); on an already-initialized volume, create it once by hand
(command in that file).

## Access control per public subdomain

Depends on whether Cloudflare Access is in front (public instance,
`docker-compose.tunnel.yml`) or not (self-hosters, default):

- **With Cloudflare Access**: every admin hostname (`grafana.`, `portainer.`,
  `errors.`, `flags.`, `home.<DOMAIN>`) sits behind a Cloudflare Tunnel, gated
  by GitHub SSO + MFA before a request ever reaches Caddy — see "Cloudflare
  Tunnel + Access" below. Grafana/GlitchTip/Portainer additionally point
  their own OIDC config at Access as the identity provider (no second
  login); Homepage and Unleash have no OIDC of their own, so Access alone is
  the gate for Homepage, and Unleash needs a carve-out (see below).
- **Without it (self-host default)**: three patterns, picked by what the
  add-on itself supports — **true OIDC SSO** via Authelia (Grafana,
  GlitchTip, Portainer), **Caddy `forward_auth`** against Authelia
  (Homepage, which has no login of its own), or **own login only, no
  Authelia** (Unleash — no OIDC support and its Frontend API must stay
  reachable unauthenticated by every visitor's browser; Umami — same
  reasoning for its tracker/collect endpoint; Quackback — runs as its own
  unmodified deployment with its own email-OTP login).

## Cloudflare, real client IPs & bot protection

Not a compose override — a DNS-level choice plus two small pieces of app
code. See root README "Cloudflare" and "Bot protection" for dashboard setup.
`TRUST_PROXY_HOPS` (`apps/api/src/main.ts`) and `TurnstileService`
(`apps/api/src/auth/turnstile.service.ts`) are the two integration points.

## Maintenance mode

Toggled by the presence of a marker file at `docker/caddy-flags/maintenance`
(bind-mounted, not a named volume, so it's a plain path an admin can toggle
over SSH) rather than an env var or redeploy:

```sh
touch docker/caddy-flags/maintenance   # on
rm docker/caddy-flags/maintenance      # off
```

That cuts everyone off. To warn ahead of time instead, use the news banner.

## News banner

A strip across the top of the site, driven by the `NEWS_BANNER` flag in
Unleash, so it appears and disappears for everyone without a reload or a
deploy. The flag is the switch: turn it off and the banner is gone whatever
its payload says.

What it shows comes from a variant of that flag with a **JSON** payload:

```json
{
  "id": "2026-10-04-db-upgrade",
  "key": "maintenance_scheduled",
  "severity": "warning",
  "dismissible": false,
  "placement": "all",
  "startsAt": "2026-10-01T08:00:00Z",
  "endsAt": "2026-10-04T05:00:00Z",
  "data": { "start": "2026-10-04T01:00:00Z", "end": "2026-10-04T03:00:00Z" }
}
```

| Field                 | Required | Meaning                                                                                                                                                       |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | yes      | Unique per announcement: a closed banner stays closed for that id only, so a new announcement needs a new id.                                                 |
| `key`                 | yes      | Which translated message: `maintenance_scheduled` (needs `data.start` and `data.end`, ISO datetimes, shown in each reader's time zone) or `degraded_service`. |
| `severity`            | no       | `info` (default) or `warning`.                                                                                                                                |
| `dismissible`         | no       | `true` by default; `false` keeps it on screen.                                                                                                                |
| `placement`           | no       | `app` (signed-in pages under `/app`), `public` (the rest: landing, legal pages, sign-in) or `all` (default).                                                  |
| `startsAt` / `endsAt` | no       | Display window, ISO datetimes. Without them, the flag alone decides.                                                                                          |
| `data`                | depends  | The values the message needs.                                                                                                                                 |

The text itself never comes from Unleash, so the banner stays in each
reader's language. A malformed payload shows nothing; the browser console
says why. A new message means a new key in `apps/web/src/lib/news-banner.ts`,
its text in `apps/web/messages`, and its case in `NewsBanner.svelte`.

## Operator checklist (public instance)

Annual: confirm the OVH account behind loomkeep.app still carries Logan's
real identity and address — required for the LCEN art. 6-III exemption from
publishing personal mentions légales.

## Backups

Two independent layers, both encrypted for the same key:

- **Local, in-app** (`apps/api/src/admin/backup.service.ts`) — dumps only
  the `loomkeep` database, daily, 7 kept. Restore via `/admin/backup`.
- **Offsite, host-level** (`docker/backup-offsite.sh`, run via VPS cron) —
  covers what the in-app one doesn't: `unleash`/`glitchtip` and Quackback's
  entire separate stack. Ships to Cloudflare R2 via `rclone`. See the
  script's own header for exact coverage and one-time setup steps.

### The encryption key

Both layers encrypt for the same [age](https://github.com/FiloSottile/age)
public key (`BACKUP_ENCRYPTION_PUBLIC_KEY` in `.env`) — asymmetric on
purpose, this VPS only ever needs the public key. Generate the keypair on
your own machine, never on the VPS:

```sh
age-keygen -o loomkeep-backup-key.txt
# Public key: age1... — paste this into BACKUP_ENCRYPTION_PUBLIC_KEY in .env
```

Save `loomkeep-backup-key.txt` somewhere durable and secret, then delete it
from wherever you ran this command. Losing it makes every backup taken with
the matching public key permanently unrecoverable.

To restore: `age -d -o dump.sql backup-file.sql.age`, then feed `dump.sql`
into `/admin/backup`'s restore flow (in-app dumps) or `psql` directly
(offsite dumps). **Test this at least once** — an offsite backup nobody has
decrypted is a hypothesis, not a guarantee.

## Image vulnerability scanning (Trivy)

`.github/workflows/trivy.yml` scans the built images for known CVEs —
separate from `ci.yml`'s `docker-build-images` job (which only validates
the Dockerfiles still build). Results go to the Security tab as SARIF,
never fail the build.

## Job monitoring (Healthchecks.io)

Not a compose override — no container to run. `JobRunService`
(`apps/api/src/jobs/job-run.service.ts`) pings a per-job Healthchecks.io URL
on every `@Cron()` run, success and failure — the "no ping arrived in time"
alerting catches a job that silently stopped firing at all, which the
app's own `JobRun` table can't see. See root README "Job monitoring" for
account setup. The observability override additionally scrapes
Healthchecks.io's own metrics endpoint into Prometheus/Grafana.

## API metrics (`docker-compose.observability.yml`)

The API exposes `GET /api/metrics` in Prometheus text format: Node/process
internals (event loop, heap, GC, CPU) plus one HTTP latency histogram
(`http_request_duration_seconds`, labelled by method, matched route pattern
and status). Technical only — user/library figures stay in the admin
dashboard, which reads them from Postgres rather than from a 15s-resolution
time series.

Prometheus reaches it over the internal Docker network and authenticates
with a bearer token, so it never has to go through Caddy and the base
`docker-compose.yml` (which publishes the API port directly, no reverse
proxy) doesn't hand the endpoint to anyone who can reach the host. Set
`METRICS_API_KEY` in `.env` and write the same value, with no trailing
newline, to `docker/observability/metrics_token` (copy from
`metrics_token.example`, gitignored — same convention as the Healthchecks.io
token above). Left empty, the endpoint fails closed and only the `api`
scrape target goes down.

## Per-query Postgres metrics (`docker-compose.observability.yml`)

`postgres_exporter`'s `stat_statements` collector needs the `pg_stat_statements`
extension preloaded, which only takes effect on a Postgres restart — and,
same pattern as "Shared Postgres for add-ons" above, the extension itself
is only auto-created on a brand-new `db` volume
(`observability/init-pg-stat-statements.sql`). On an already-initialized
volume, after the observability override is deployed and `db` has
restarted, create it once by hand:

```sh
docker compose exec db psql -U ${POSTGRES_USER:-loomkeep} -d ${POSTGRES_DB:-loomkeep} -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
```

## Error tracking (`docker-compose.glitchtip.yml`)

GlitchTip — self-hosted, Sentry-API-compatible. The app reports to it via
the standard Sentry SDKs (`@sentry/node`, `@sentry/sveltekit`), gated on
their DSN env var being set. Errors only: no tracing, no session replay, no
source-map upload yet.

## User feedback board (`docker-compose.quackback.yml`)

[Quackback](https://quackback.io) — an open-source, self-hostable
alternative to Canny/UserVoice. Unlike every other add-on here, it is
**not** reimplemented as Loomkeep-managed services: translating their own
stack (custom Postgres, Dragonfly, MinIO) into this repo would silently
drift the moment Quackback's stack changes upstream. Instead it runs as its
own separate, unmodified deployment, bootstrapped with
`docker/quackback-bootstrap.sh` — this repo's override only wires Caddy to
its published host port.

## Cloudflare Tunnel + Access (`docker-compose.tunnel.yml`)

Public-instance-specific (loomkeep.app's own Cloudflare account, not a
generic self-host feature). `cloudflared` holds an outbound-only connection
to Cloudflare's edge for every admin hostname — no inbound port left open to
bypass Cloudflare Access with, unlike plain DNS-proxying where the VPS's
origin IP is still directly reachable. Access enforces GitHub SSO + MFA
before a request ever reaches the tunnel.

Each admin add-on's own `*.caddy` file carries two blocks on the same file:
the normal public hostname (Caddy's automatic HTTPS, what self-hosters on
plain DNS use) and an explicit `{$X_SITE_ADDRESS}:8080` — an explicit port
disables automatic HTTPS, so it stays plain HTTP, matched by the `Host`
header `cloudflared` forwards. `docker-compose.tunnel.yml` exposes that
`:8080` port to `cloudflared` only (`expose`, never `ports` — same trust
boundary as `db`), so the same Caddyfile works unmodified whether or not
this add-on is in use.

Setup is entirely on the Cloudflare Zero Trust dashboard (tunnel + token,
one Public Hostname per admin subdomain pointing at `http://caddy:8080`,
one Access Application per hostname) — see the compose file's own header
for the exact steps. **Unleash needs a carve-out**: every visitor's browser,
not just admins, polls `flags.<DOMAIN>/api/frontend` unauthenticated for
live feature flags — a second Access Application scoped to that path with a
public/bypass policy is required before enforcing Access on that hostname.

Self-hosters without Cloudflare keep using plain DNS + Caddy's automatic
HTTPS, with `docker-compose.authelia.yml` for SSO instead (see "Single
sign-on" below).

## Single sign-on (`docker-compose.authelia.yml`)

**Not deployed on the public instance anymore** — Cloudflare Access
(above) covers that role there instead. This section, and the OIDC/
`forward_auth` wiring it describes, is still the documented path for
self-hosters who want SSO without a Cloudflare account.

[Authelia](https://www.authelia.com/) — chosen over Authentik for its
footprint (single binary + SQLite, no dedicated Postgres/Redis). Real
secrets (session/storage/OIDC secrets, the RSA JWKS signing key, the user
database) live in `docker/authelia/configuration.yml` and
`users_database.yml` — gitignored, copied from `*.example` templates. See
root README "Single sign-on" for the exact per-app OIDC values to paste.
