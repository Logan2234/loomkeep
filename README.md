# Loomkeep

[![CI](https://github.com/Logan2234/tracklore/actions/workflows/ci.yml/badge.svg)](https://github.com/Logan2234/tracklore/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Logan2234/tracklore/graph/badge.svg)](https://codecov.io/gh/Logan2234/tracklore)
[![healthchecks.io](https://healthchecks.io/badge/e006c4d6-231b-434f-8357-4fa7ab/CWqULdZN.svg)](https://healthchecks.io/)
[![CodeQL](https://github.com/Logan2234/tracklore/actions/workflows/codeql.yml/badge.svg)](https://github.com/Logan2234/tracklore/actions/workflows/codeql.yml)
[![License](https://img.shields.io/github/license/Logan2234/tracklore)](LICENSE)
[![Version](https://img.shields.io/github/package-json/v/Logan2234/tracklore)](CHANGELOG.md)
[![Last commit](https://img.shields.io/github/last-commit/Logan2234/tracklore)](https://github.com/Logan2234/tracklore/commits/main)
[![Uptime](https://img.shields.io/uptimerobot/status/m803690521-ce3fa37e29f1160d9104e331)](https://dashboard.uptimerobot.com/monitors)

Self-hosted tracker for **series, movies, anime, games, books and music** —
with optional friends/reviews/comments social features. Built as a TV Time
replacement you fully own: your data lives in your own PostgreSQL, catalogues
come live from [TMDB](https://www.themoviedb.org/) (movies & series),
[AniList](https://anilist.co/) (anime), [IGDB](https://www.igdb.com/) (games),
[Google Books](https://books.google.com/) (books) and
[MusicBrainz](https://musicbrainz.org/) (music).

## Stack

- **Monorepo** pnpm workspaces, 100% TypeScript
- `apps/api` — NestJS + Prisma + PostgreSQL (JWT auth, rotating refresh tokens)
- `apps/web` — SvelteKit PWA (installable, dark UI), talks to the API
- `packages/shared` — DTOs/enums shared between front and back

Key design choice: the database is an **on-demand cache**. Searching queries
TMDB/AniList live; a media is persisted (with its seasons, episodes and
external IDs — TMDB/AniList/TVDB/IMDB) only when a user tracks it. Episode
watches are stored **one row per viewing**, so rewatches are first-class.

## Self-hosting (Docker)

```sh
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, both JWT secrets and TMDB_API_TOKEN.
docker compose -f docker/docker-compose.yml up -d --build
```

Every `-f ...` combo below has a matching `pnpm docker:*` shortcut (see
`package.json`) — `docker:dev`, `docker:prod`, and `docker:full` (every
optional add-on at once, for local testing of the whole stack); the less
common one-off combos below are still spelled out with their full `-f`
chain since there's no script for every permutation.

Then open <http://localhost:8080>, create an account, done.
On a NAS, set `PUBLIC_API_URL` and `WEB_ORIGIN` to the host's address
(e.g. `http://nas.local:3000/api` and `http://nas.local:8080`).

Upgrades: `git pull && docker compose -f docker/docker-compose.yml up -d --build`
— database migrations run automatically when the API boots.

### TMDB API key

Create a free account on themoviedb.org, then copy the **API Read Access
Token (v4)** from Settings → API into `TMDB_API_TOKEN`. Anime search (AniList)
works without any key.

### Email (SMTP)

Password reset, email verification, account change confirmations and email
alerts for new episodes all go through `SMTP_*` in `.env`. Empty = email is
silently disabled, everything else still works (the reset-password flow just
has no way to reach you).

[Brevo](https://www.brevo.com) has a free SMTP relay (300 emails/day, no
credit card): create an account (personal accounts are fine, no company or
website required), then **SMTP & API** in the sidebar for `SMTP_HOST`,
`SMTP_USER` and `SMTP_PASS`.

### Public hosting (VPS)

For a stack that's always up under your own domain (e.g. an OVH VPS), and
reachable from your phone as an installed PWA (a public HTTPS URL is
required — the service worker and Web Push refuse plain HTTP on a real
device), use the `docker/docker-compose.prod.yml` override. It adds a
single-origin Caddy proxy, and Caddy requests and renews a real Let's
Encrypt certificate itself, serving HTTPS on the standard ports.

1. Point the domain's **A** (and **AAAA** if you have IPv6) record at the
   VPS's public IP, and make sure ports **80** and **443** are open on the
   VPS firewall (80 is required for the Let's Encrypt HTTP challenge, and
   Caddy redirects it to 443).
2. Set the domain once in `.env` — the override derives `PUBLIC_API_URL`,
   `WEB_ORIGIN` and Caddy's `SITE_ADDRESS` from it:

   ```sh
   DOMAIN=loomkeep.app
   ```

3. Start the stack with the prod override:

   ```sh
   docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d --build
   ```

4. Open `https://<DOMAIN>` — the first request can take a few seconds while
   Caddy obtains the certificate. Check `docker compose logs caddy` if it
   doesn't come up (common causes: DNS not yet propagated, or port 80/443
   blocked by the VPS provider's firewall in addition to the OS one — OVH
   VPS also has a network firewall in the control panel that must allow
   80/443 separately from any `ufw`/`iptables` rules on the box).

**Auto-deploy from CI**: `.github/workflows/deploy.yml` redeploys automatically
on every successful CI run on `main` (`git reset --hard origin/main` +
`docker compose up -d --build`, no `-f` flags). It relies on `COMPOSE_FILE`
being set in the VPS's own `.env` (see `.env.example`) to know which override
files to combine — so turning an optional add-on (observability, Portainer,
GlitchTip, ...) on or off in production is done by editing that line on the
VPS, not by touching the workflow.

### Logs and monitoring (optional)

The API logs structured JSON (level, route, duration) via `nestjs-pino` —
`docker compose logs api` works out of the box, and every service's logs are
capped at 10MB × 5 files so they can't slowly fill the disk. For a
searchable log history, dashboards, and metrics, add the observability
override on top of whichever deployment you're running:

```sh
# set GRAFANA_ADMIN_PASSWORD in .env first
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml -f docker/docker-compose.observability.yml up -d --build
```

This adds:

- **Grafana + Loki + Promtail** — Promtail ships every container's logs into
  Loki automatically.
- **Prometheus + node_exporter + postgres_exporter** — host-level metrics
  (CPU/RAM/disk) and Postgres metrics (connections, table sizes...), both
  pre-wired as a Grafana data source.

If you set `DOMAIN` (see "Public hosting" above), Grafana is also reachable
publicly at `grafana.<DOMAIN>` via Caddy, gated by Grafana's own login. It's
always reachable at `127.0.0.1:3001` too, whether or not `DOMAIN` is set —
useful as a tunnel-only fallback:

```sh
ssh -L 3001:localhost:3001 <user>@<your-vps>
```

then open `http://localhost:3001` locally. Prometheus itself has no exposed
port at all — it's purely a Grafana data source, queried through Grafana's
own auth.

### Job monitoring (optional)

Grafana/GlitchTip tell you when the app is unhealthy or throwing errors, but
neither notices a scheduled job that silently stops firing (a crashed
scheduler, a hung job that never throws) — Postgres and the app can both
look perfectly healthy while a cron job just isn't running anymore. The API
has four such jobs (`src/jobs/job-keys.ts`): notification scan (hourly),
media cache refresh (every 6h), reports digest and the automatic backup
(both daily).

[Healthchecks.io](https://healthchecks.io) closes that gap: each job pings
it once it finishes, and Healthchecks.io itself alerts you if an expected
ping doesn't show up on schedule — no add-on to run, works whether or not
you have the observability override above.

1. Create a free account, then one check per job, with a **Period**/**Grace**
   matching its schedule (e.g. Period 1h for the notification scan, Period 6h
   for the cache refresh, Period 1 day for the digest and the backup — a
   Grace of an hour or so absorbs normal jitter).
2. Copy each check's ping URL into `.env`:
   `HEALTHCHECKS_NOTIFICATIONS_SCAN_URL`, `HEALTHCHECKS_MEDIA_REFRESH_STALE_URL`,
   `HEALTHCHECKS_REPORTS_DIGEST_URL`, `HEALTHCHECKS_BACKUP_URL`. Any left
   empty just means that job doesn't ping — nothing else is affected.
3. Optional: for the Homepage tile below, a read-only API key
   (`HEALTHCHECKS_API_KEY`, Project Settings → API Access) shows an
   up/down count across every check at a glance.
4. Optional, if you also run the observability override: Prometheus scrapes
   Healthchecks.io's own per-project metrics endpoint (`hc_check_up` per
   check) instead of just a Homepage tile — native Grafana history/alerting
   on job health, no extra container. Generate a read-only API key (Project
   Settings → API Access), write it (no trailing newline) to
   `docker/observability/healthchecks_token` (copy from
   `healthchecks_token.example`, gitignored — same convention as Authelia's
   secrets), and set the project's UUID in the `healthchecks` job's
   `metrics_path` in `docker/observability/prometheus.yml`.

### Docker management UI (optional)

```sh
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml -f docker/docker-compose.portainer.yml up -d --build
```

Adds [Portainer](https://www.portainer.io/), reachable at
`portainer.<DOMAIN>` via Caddy — a web UI for containers/images/volumes
without SSH. Gated by Portainer's own admin login (set on first visit).

### Error tracking (optional)

```sh
# set GLITCHTIP_SECRET_KEY and GLITCHTIP_DB_PASSWORD in .env first
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml -f docker/docker-compose.glitchtip.yml up -d --build
```

Adds [GlitchTip](https://glitchtip.com/) (Sentry-API-compatible, self-hosted
error tracker), reachable at `errors.<DOMAIN>` via Caddy. Where the log
search above shows every log line, GlitchTip groups exceptions by
fingerprint into a single "issue" with an occurrence count, and can email
you the moment a _new_ error type first appears rather than waiting for you
to go looking. Gated by GlitchTip's own login (the first visitor sets up the
org). Runs its own dedicated Postgres + Valkey, separate from the app's
database. Email alerts are off out of the box — see the
`GLITCHTIP_EMAIL_URL` comment in `.env.example` to enable them.

The app itself only _reports_ to GlitchTip once you create a project there
(one for the API, platform "Node"; one for the web app, platform
"JavaScript") and set the resulting DSNs — `GLITCHTIP_API_DSN` and
`PUBLIC_GLITCHTIP_WEB_DSN` in `.env` (both empty by default, meaning
reporting stays off). Production only; `pnpm dev` never reports here. Errors
only — no performance tracing on the web side, no session replay (GlitchTip
doesn't implement the replay protocol, so those events would just be
dropped). See `apps/api/src/instrument.ts` and `apps/web/src/hooks.client.ts`.

### Landing page (optional)

```sh
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml -f docker/docker-compose.authelia.yml -f docker/docker-compose.homepage.yml up -d --build
```

Adds [Homepage](https://gethomepage.dev/), reachable at `home.<DOMAIN>` — one
page with a link tile for every dashboard above (Grafana, Portainer,
GlitchTip, the app itself, Authelia, plus a few external bookmarks) and a
Google search bar. **Requires the single sign-on section below too** —
Homepage has no login of its own and is gated entirely by Authelia's
`forward_auth`.

No Docker socket access — deliberately. Grafana and Portainer get live
widgets through their own APIs (an admin password reused from
`GRAFANA_ADMIN_USER`/`PASSWORD`, and a dedicated Portainer access token);
GlitchTip has no native Homepage widget, so its tile calls GlitchTip's own
Sentry-compatible issues API directly to list recent unresolved errors — the
most fragile of the three, first thing to check if it ever goes blank.
Per-container CPU/RAM stats on every tile were considered and skipped:
Grafana + Prometheus + cAdvisor already cover that in more depth, so a
second Docker-access path here would've been redundant. To wire up the
widgets, set in `.env` (see the comments there for exactly where to
generate each): `PORTAINER_API_KEY`, `PORTAINER_ENV_ID`,
`GLITCHTIP_API_TOKEN`, `GLITCHTIP_ORG_SLUG`. Any left empty just means that
tile's widget shows no data — nothing else breaks.

The app's own tile shows its `/health` status (no key needed — same
endpoint Docker's own healthcheck uses). A separate "Statistiques" tile
shows the registered-account count via a small dedicated endpoint,
`GET /api/public-stats/summary` (`apps/api/src/admin/public-stats.controller.ts`)
— deliberately not the full `/admin/stats` page's `getStats()`, which
computes cohorts/retention curves too heavy to run on every ~10s widget
poll. Gated by a shared secret (`HOMEPAGE_STATS_API_KEY` in `.env`, sent as
a bearer token) rather than the app's normal JWT login, since Homepage has
no user session — generate any long random string, the endpoint fails
closed (unreachable, not just widget-less) if it's unset. Authelia's tile
lives in
`bookmarks.yaml`, not the main service tiles — nothing to manage there
day-to-day, kept only as a visible reminder the dashboards sit behind SSO.
`bookmarks.yaml` also has a "recent error logs" deep link straight into
Grafana Explore's Loki view (last hour, every container) — the single most
fragile link on the page, since Grafana's Explore URL format is
version-specific and has changed before; falls back to opening Grafana
normally if it ever breaks.

### Single sign-on (optional)

One login for every dashboard above instead of a separate password each —
[Authelia](https://www.authelia.com/) sits in front of Caddy and either
gates a site directly (Homepage) or lets the app itself redirect to it via
OIDC (Grafana, GlitchTip, Portainer — visiting a second app after the first
just bounces through silently, no second password).

1. Copy the two templates and fill in every `REPLACE_ME` (never share the
   plaintext values in chat, including with Claude):

   ```sh
   cp docker/authelia/configuration.yml.example docker/authelia/configuration.yml
   cp docker/authelia/users_database.yml.example docker/authelia/users_database.yml
   ```

2. Generate the secrets (run each once, paste the output where the matching
   `REPLACE_ME` says so):

   ```sh
   docker run --rm authelia/authelia:4.39.20 authelia crypto rand --length 64   # x4: reset-password jwt_secret, session secret, storage encryption_key, oidc hmac_secret
   cd docker/authelia && docker run --rm -v "$(pwd):/out" authelia/authelia:4.39.20 authelia crypto pair rsa generate -d /out && cd -
   # writes docker/authelia/private.pem — paste its full contents (indented, including
   # -----BEGIN/END PRIVATE KEY-----) into the oidc.jwks key, then delete both
   # private.pem and public.pem (the -v mount is required — without it "-d ."
   # writes inside the throwaway --rm container instead of your machine)
   docker run --rm authelia/authelia:4.39.20 authelia crypto hash generate argon2 --password 'your-own-password'   # your login — never tell anyone (including Claude) the plaintext
   ```

   Every `crypto hash generate`/`crypto rand` command above prints a
   labelled line, e.g. `Digest: $argon2id$v=19$...` or
   `Random Value: xY7k...` — copy only the part **after** the `Digest:`/
   `Random Value:` label into the config. Pasting the label too is the
   single most common way this setup silently fails to authenticate.

   Log in with the **username** (the YAML key in `users_database.yml`,
   e.g. `logan`), not the email address — Authelia's file backend doesn't
   accept email-as-username at the login form.

3. For each of the three OIDC clients (grafana/glitchtip/portainer) in
   `docker/authelia/configuration.yml`: generate a random secret and its hash, keep
   the plaintext somewhere safe (you'll need it in step 5/6), paste the hash
   into `client_secret`:

   ```sh
   docker run --rm authelia/authelia:4.39.20 authelia crypto rand --length 64 --charset alphanumeric   # the plaintext
   docker run --rm authelia/authelia:4.39.20 authelia crypto hash generate pbkdf2 --variant sha512 --password 'paste-the-plaintext-above'   # the hash, goes in configuration.yml
   ```

4. Also fill in `notifier.smtp.username`/`password` with the same values as
   this repo's `SMTP_USER`/`SMTP_PASS` — **unlike the rest of the app,
   Authelia hard-fails to start without working SMTP** (it's a startup
   health check, not an optional feature — no blank-SMTP degraded mode
   here).

5. Set `GRAFANA_OIDC_CLIENT_SECRET` in `.env` to the **plaintext** secret
   from step 3 for the `grafana` client.

6. Bring the stack up, then do the two integrations that can't be done
   through config alone:

   ```sh
   docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml -f docker/docker-compose.authelia.yml -f docker/docker-compose.observability.yml -f docker/docker-compose.portainer.yml -f docker/docker-compose.glitchtip.yml up -d --build
   ```

   - **GlitchTip**: on the VPS, temporarily set `ENABLE_ADMIN: true`
     in `docker-compose.glitchtip.yml` and `docker compose up -d glitchtip`
     (no rebuild, no git push needed — this is a runtime toggle, not a code change).
     Visit `https://errors.<DOMAIN>/admin/socialaccount/socialapp/`, add a
     SocialApp — Provider `OpenID Connect`, Provider ID `authelia`, Client
     ID `glitchtip`, Secret Key = the plaintext from step 3 for the
     `glitchtip` client, Settings
     `{"server_url":"https://auth.<DOMAIN>/.well-known/openid-configuration"}`.
     Then set `ENABLE_ADMIN` back to `false` in `docker-compose.glitchtip.yml` and
     `docker compose up -d glitchtip` again.
   - **Portainer**: Settings → Authentication → OAuth → Provider `Custom`,
     Client ID `portainer`, Client Secret = the plaintext from step 3 for
     the `portainer` client, Authorization URL
     `https://auth.<DOMAIN>/api/oidc/authorization`, Access Token URL
     `https://auth.<DOMAIN>/api/oidc/token`, Resource URL
     `https://auth.<DOMAIN>/api/oidc/userinfo`, Redirect URL
     `https://portainer.<DOMAIN>`, User Identifier `preferred_username`,
     Scopes `openid profile email` — **space-separated, no commas**:
     Portainer's own Scopes field placeholder looks comma-separated but
     sends whatever you type verbatim as one raw OAuth `scope` parameter, so
     commas produce a single invalid scope
     (`invalid_scope: ... 'openid,profile,email'`) instead of three valid
     ones.

Grafana needs no manual step — it's fully wired via env vars in
`docker/docker-compose.observability.yml`.

**Logout is one-way**: Authelia doesn't yet support RP-Initiated Logout (the
OIDC mechanism for propagating a logout back to the identity provider —
[open upstream issue](https://github.com/authelia/authelia/issues/5057)), so
logging out of Grafana/GlitchTip/Portainer individually only ends that app's
own session, not the Authelia SSO session itself. To fully log out, visit
`auth.<DOMAIN>` directly — otherwise the session just expires on its own
after `session.expiration` (`authelia/configuration.yml`, `1h` by default).

## Development

```sh
pnpm i
docker run -d --name loomkeep-dev-db -e POSTGRES_USER=loomkeep \
  -e POSTGRES_PASSWORD=loomkeep -e POSTGRES_DB=loomkeep \
  -p 5433:5432 postgres:18-alpine
cp .env.example .env                     # then add your TMDB token — read by the API too, see below
cp apps/api/.env.example apps/api/.env
pnpm --filter @loomkeep/api exec prisma migrate dev
pnpm build:package
pnpm dev        # api on :3000, web on :5173
```

Tests:

```sh
pnpm --filter @loomkeep/api test        # unit (provider mapping)
pnpm --filter @loomkeep/api test:e2e    # full API flow, isolated "e2e" schema
```

## License

AGPL-3.0 — self-host freely; run it as a service, share your changes.
