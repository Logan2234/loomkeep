# Loomkeep

**Build & quality** </br>
[![CI](https://img.shields.io/github/actions/workflow/status/Logan2234/loomkeep/ci.yml?branch=main&label=CI)](https://github.com/Logan2234/loomkeep/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Logan2234/loomkeep/graph/badge.svg)](https://codecov.io/gh/Logan2234/loomkeep)

**Security** </br>
[![CodeQL](https://img.shields.io/github/actions/workflow/status/Logan2234/loomkeep/codeql.yml?branch=main&label=CodeQL)](https://github.com/Logan2234/loomkeep/actions/workflows/codeql.yml)
[![Trivy](https://img.shields.io/github/actions/workflow/status/Logan2234/loomkeep/trivy.yml?branch=main&label=Trivy)](https://github.com/Logan2234/loomkeep/actions/workflows/trivy.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/Logan2234/loomkeep/badge)](https://scorecard.dev/viewer/?uri=github.com/Logan2234/loomkeep)
[![Security Policy](https://img.shields.io/badge/security-policy-blue)](SECURITY.md)

**Status in production** </br>
[![healthchecks.io](https://healthchecks.io/badge/e006c4d6-231b-434f-8357-4fa7ab/CWqULdZN.svg)](https://healthchecks.io/)
[![Uptime](https://img.shields.io/uptimerobot/status/m803690521-ce3fa37e29f1160d9104e331)](https://stats.uptimerobot.com/3nvxkigZ8T)

**Project** </br>
[![License](https://img.shields.io/github/license/Logan2234/loomkeep)](LICENSE)
[![Version](https://img.shields.io/github/package-json/v/Logan2234/loomkeep)](CHANGELOG.md)
[![Last commit](https://img.shields.io/github/last-commit/Logan2234/loomkeep)](https://github.com/Logan2234/loomkeep/commits/main)

**Support** </br>
[![Buy Me a Coffee](https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=☕&slug=loomkeep&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff)](https://www.buymeacoffee.com/loomkeep)
[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/loomkeep)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/Logan2234?logo=github&style=for-the-badge)](https://github.com/sponsors/Logan2234)
[![Liberapay](https://img.shields.io/liberapay/patrons/loomkeep.svg?logo=liberapay&style=for-the-badge)](https://liberapay.com/loomkeep/donate)

Self-hosted tracker for **series, movies, anime, games, books and music** —
with optional friends/reviews/comments social features. Built as a TV Time
replacement you fully own: your data lives in your own PostgreSQL, catalogues
come live from [TMDB](https://www.themoviedb.org/) (movies & series),
[AniList](https://anilist.co/) (anime), [IGDB](https://www.igdb.com/) (games),
[Open Library](https://openlibrary.org/) (books) and
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
docker compose -f docker/docker-compose.yml pull
docker compose -f docker/docker-compose.yml up -d
```

Images are pre-built by CI and pulled from GHCR (`ghcr.io/logan2234/loomkeep-{api,web}`)
— no local build needed.

Then open <http://localhost:8080>, create an account, done.
On a NAS, set `PUBLIC_API_URL` and `WEB_ORIGIN` to the host's address
(e.g. `http://nas.local:3000/api` and `http://nas.local:8080`).

Upgrades: `docker compose -f docker/docker-compose.yml pull && docker compose -f docker/docker-compose.yml up -d`
— database migrations run automatically when the API boots.

### Combining add-ons

Every section below (public hosting, logs/monitoring, Portainer, ...) adds
one more optional `docker-compose.<name>.yml` override on top of the base
file. Past the first override, don't chain `-f` flags by hand — set
`COMPOSE_FILE` in `.env` instead (Compose reads it automatically,
colon-separated; see the commented-out example in `.env.example`):

```sh
COMPOSE_FILE=docker/docker-compose.yml:docker/docker-compose.prod.yml:docker/docker-compose.observability.yml
```

then always run the same two commands, no `-f` needed — every section below
just tells you which file(s) to add to that line:

```sh
docker compose pull
docker compose up -d
```

This is the same mechanism the VPS auto-deploy uses (see "Auto-deploy from
CI" below) — turning an add-on on or off in production is editing that one
line, nothing else.

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

3. Add `docker/docker-compose.prod.yml` to `COMPOSE_FILE` in `.env` (see
   "Combining add-ons" above), then start the stack:

   ```sh
   docker compose pull
   docker compose up -d
   ```

4. Open `https://<DOMAIN>` — the first request can take a few seconds while
   Caddy obtains the certificate. Check `docker compose logs caddy` if it
   doesn't come up (common causes: DNS not yet propagated, or port 80/443
   blocked by the VPS provider's firewall in addition to the OS one — OVH
   VPS also has a network firewall in the control panel that must allow
   80/443 separately from any `ufw`/`iptables` rules on the box).

**Auto-deploy from CI**: `.github/workflows/deploy.yml` redeploys automatically
on every successful CI run on `main` (`git reset --hard origin/main` +
`docker compose pull && docker compose up -d`, no `-f` flags, pinned to the
images CI built and pushed to GHCR for that exact commit). It relies on `COMPOSE_FILE`
being set in the VPS's own `.env` (see `.env.example`) to know which override
files to combine — so turning an optional add-on (observability, Portainer,
GlitchTip, ...) on or off in production is done by editing that line on the
VPS, not by touching the workflow.

### Cloudflare (optional, recommended for public hosting)

If the domain's DNS is on Cloudflare (free plan is enough), proxying it
through Cloudflare instead of pointing DNS straight at the VPS hides the
origin IP and adds free DDoS/bot mitigation and edge caching in front of
Caddy. None of this is required — self-hosting works identically with
plain DNS — but for a publicly reachable instance it's a meaningful upgrade
for zero cost. One-time dashboard setup, no code:

1. **SSL/TLS mode**: **Full (Strict)**, not Flexible. Caddy already gets a
   real Let's Encrypt certificate (see "Public hosting" above) — Flexible
   would make Cloudflare talk to the origin over plain HTTP, defeating that.
2. **Always Use HTTPS**: on.
3. **Proxy status**: orange-cloud every subdomain actually served by this
   stack (the apex, `grafana.`, `errors.`, `portainer.`, `auth.`, `home.`,
   `feedback.`, ...) — not just the main app. Free-tier proxying supports
   WebSockets automatically (Grafana Live needs this), no extra config.
4. **Bot Fight Mode**: on (Security → Bots) — free-tier automated-traffic
   filtering, no configuration needed.
5. Optional, one **Cache Rule** (or Page Rule on very old accounts) caching
   `/_app/immutable/*` aggressively — SvelteKit's own hashed, cache-forever
   build assets, safe to cache at the edge indefinitely.

**Trusting the real client IP**: once Cloudflare proxies traffic, every
request Caddy sees comes from Cloudflare's edge, not the actual visitor —
without adjustment, rate-limiting (`ThrottlerGuard`) and `@Ip()` would see
Cloudflare's IP for every request instead of the real one. This is already
handled: the API only trusts `X-Forwarded-For` when `TRUST_PROXY=true`
(set automatically by `docker-compose.prod.yml`, since Caddy is always the
one hop in front there — see `src/main.ts`). Self-host without the prod
override leaves it off by default, since nothing there guarantees a proxy
sits in front of the API.

**Residual risk worth locking down** (manual, outside this repo): the base
`docker-compose.yml` still publishes the API's port directly
(`3000:3000`), so if that port is reachable from the internet on the VPS,
someone could bypass Cloudflare and Caddy entirely, hitting the API
directly and forging `X-Forwarded-For` themselves — `TRUST_PROXY=true`
alone doesn't protect against that. Two independent ways to close it: your
cloud provider's own firewall/security group only allowing 22/80/443 in
(not just the VPS's OS-level `ufw`/`iptables` — Docker is known to
sometimes bypass `ufw` rules by writing to `iptables` directly), and/or a
Caddy `remote_ip` matcher only accepting connections from
[Cloudflare's published IP ranges](https://www.cloudflare.com/ips/),
rejecting everything else with a 403. Not wired into this repo's Caddyfile
since Cloudflare's ranges can change over time and hardcoding them here
would need periodic maintenance — worth doing by hand on the actual VPS if
you want the extra layer.

### Bot protection (Cloudflare Turnstile, optional)

A CAPTCHA-alternative widget on the register form, gated the same way
every optional integration here is: empty env var = feature off, nothing
else changes.

1. Requires a Cloudflare account (see above), but not proxying — Turnstile
   works independently of whether DNS/proxy is set up.
2. Cloudflare dashboard → Turnstile → Add widget → **Managed** challenge
   type, domain = your instance's domain.
3. Copy the **Site Key** into `PUBLIC_TURNSTILE_SITE_KEY` (public, read by
   the web app) and the **Secret Key** into `TURNSTILE_SECRET_KEY` (private,
   read by the API — never expose this one to the browser).
4. Leave both empty for self-host without a Cloudflare account: no widget
   renders, and `TurnstileService.verify()` always passes server-side too.

### Logs and monitoring (optional)

The API logs structured JSON (level, route, duration) via `nestjs-pino` —
`docker compose logs api` works out of the box, and every service's logs are
capped at 10MB × 5 files so they can't slowly fill the disk. For a
searchable log history, dashboards, and metrics, add the observability
override on top of whichever deployment you're running:

Set `GRAFANA_ADMIN_PASSWORD` in `.env`, add `docker/docker-compose.observability.yml`
to `COMPOSE_FILE` (see "Combining add-ons" above), then:

```sh
docker compose pull
docker compose up -d
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

**Cloudflare Access in front of Grafana (gotcha with UptimeRobot):** if
`grafana.<DOMAIN>` is put behind Cloudflare Zero Trust Access as an extra
login layer, every unauthenticated request — including UptimeRobot's health
check — gets Access's own login/redirect response instead of ever reaching
Grafana. UptimeRobot then reports the monitor as up even when Grafana itself
is down (502), silently defeating the check. Fix: add an Access **bypass**
policy scoped to a single path — Grafana's built-in `/api/health` endpoint —
restricted to UptimeRobot's [published IP ranges](https://uptimerobot.com/locations),
then point the UptimeRobot monitor at `grafana.<DOMAIN>/api/health` instead
of the domain root. Requests from those IPs skip Access and reach
Caddy/Grafana directly, so a real outage surfaces again, while the rest of
Grafana stays behind Access. Keep the bypass scoped to that one path and IP
list rather than a blanket bypass.

### Job monitoring (optional)

Grafana/GlitchTip tell you when the app is unhealthy or throwing errors, but
neither notices a scheduled job that silently stops firing (a crashed
scheduler, a hung job that never throws) — Postgres and the app can both
look perfectly healthy while a cron job just isn't running anymore. The API
has five such jobs (`src/jobs/job-keys.ts`): notification scan (hourly),
media cache refresh (every 6h), reports digest, the automatic backup and the
inactive-accounts scan (all three daily).

[Healthchecks.io](https://healthchecks.io) closes that gap: each job pings
it once it finishes, and Healthchecks.io itself alerts you if an expected
ping doesn't show up on schedule — no add-on to run, works whether or not
you have the observability override above.

1. Create a free account, then one check per job, with a **Period**/**Grace**
   matching its schedule (e.g. Period 1h for the notification scan, Period 6h
   for the cache refresh, Period 1 day for the digest, the backup and the
   inactive-accounts scan — a Grace of an hour or so absorbs normal jitter).
2. Copy each check's ping URL into `.env`:
   `HEALTHCHECKS_NOTIFICATIONS_SCAN_URL`, `HEALTHCHECKS_MEDIA_REFRESH_STALE_URL`,
   `HEALTHCHECKS_REPORTS_DIGEST_URL`, `HEALTHCHECKS_BACKUP_URL`,
   `HEALTHCHECKS_INACTIVE_ACCOUNTS_SCAN_URL`. Any left empty just means that
   job doesn't ping — nothing else is affected.
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

Add `docker/docker-compose.portainer.yml` to `COMPOSE_FILE` (see "Combining
add-ons" above), then:

```sh
docker compose pull
docker compose up -d
```

Adds [Portainer](https://www.portainer.io/), reachable at
`portainer.<DOMAIN>` via Caddy — a web UI for containers/images/volumes
without SSH. Gated by Portainer's own admin login (set on first visit).

### Error tracking (optional)

Set `GLITCHTIP_SECRET_KEY` in `.env`, add `docker/docker-compose.glitchtip.yml`
to `COMPOSE_FILE` (see "Combining add-ons" above), then:

```sh
docker compose pull
docker compose up -d
```

Adds [GlitchTip](https://glitchtip.com/) (Sentry-API-compatible, self-hosted
error tracker), reachable at `errors.<DOMAIN>` via Caddy. Where the log
search above shows every log line, GlitchTip groups exceptions by
fingerprint into a single "issue" with an occurrence count, and can email
you the moment a _new_ error type first appears rather than waiting for you
to go looking. Gated by GlitchTip's own login (the first visitor sets up the
org). Shares the app's own Postgres instance rather than running a dedicated
database container (still keeps its own dedicated Valkey) — see the top
comment in `docker-compose.glitchtip.yml` for the one-time manual step
required on an already-running instance. Email alerts are off out of the
box — see the `GLITCHTIP_EMAIL_URL` comment in `.env.example` to enable them.

The app itself only _reports_ to GlitchTip once you create a project there
(one for the API, platform "Node"; one for the web app, platform
"JavaScript") and set the resulting DSNs — `GLITCHTIP_API_DSN` and
`PUBLIC_GLITCHTIP_WEB_DSN` in `.env` (both empty by default, meaning
reporting stays off). Production only; `pnpm dev` never reports here. Errors
only — no performance tracing on the web side, no session replay (GlitchTip
doesn't implement the replay protocol, so those events would just be
dropped). See `apps/api/src/instrument.ts` and `apps/web/src/hooks.client.ts`.

### Analytics (optional)

Set `UMAMI_APP_SECRET` in `.env` (`openssl rand -hex 32`), add
`docker/docker-compose.umami.yml` to `COMPOSE_FILE` (see "Combining add-ons"
above), then:

```sh
docker compose pull
docker compose up -d
```

Adds [Umami](https://umami.is/), a lightweight self-hosted analytics tool for
the public landing page, reachable at `stats.<DOMAIN>` via Caddy. Cookie-less
and anonymous by design (no persistent visitor ID) — tracks page views,
referrers, and clicks on the main CTA buttons and every external link
(`data-umami-event` attributes in `apps/web/src/routes/+page.svelte`), never
anything under `/app`. Shares the app's own Postgres instance rather than
running a dedicated database container — see the top comment in
`docker-compose.umami.yml` for the one-time manual step required on an
already-running instance. Gated by Umami's own login only (default
`admin`/`umami` on first visit — change it immediately); not behind
Authelia, since Umami has no OIDC support and gating the whole subdomain
would also block the tracker script for anonymous visitors.

After first login, register the site under Settings > Websites > Add
website, then set `PUBLIC_UMAMI_WEBSITE_ID` (the UUID shown there) and
`PUBLIC_UMAMI_SCRIPT_URL` (`https://stats.<DOMAIN>/loomkeep.js`) in `.env` and
redeploy the `web` service — both empty by default, meaning no tracking
script loads at all until configured.

`TRACKER_SCRIPT_NAME`/`COLLECT_API_ENDPOINT` (set in
`docker-compose.umami.yml`) already apply Umami's own documented ad-blocker
mitigation for self-hosted instances (renaming `script.js`/`/api/send` off
their defaults, which generic filter lists block by name even for
cookie-less tools). If using the Cloudflare setup above, add one more
one-time dashboard step so Umami's location stats reflect real visitors
instead of Cloudflare's edge: **Rules > Settings > Managed Transforms**,
enable **Add visitor location headers** — Caddy's `reverse_proxy` in
`umami/umami.caddy` already forwards every header untouched, so no compose
or Caddy change is needed on this side.

### Feature flags (optional)

Set `UNLEASH_ADMIN_USERNAME`, `UNLEASH_ADMIN_PASSWORD`, `UNLEASH_API_TOKEN` and
`PUBLIC_UNLEASH_FRONTEND_TOKEN` in `.env`, add `docker/docker-compose.unleash.yml` to
`COMPOSE_FILE` (see "Combining add-ons" above), then:

```sh
docker compose pull
docker compose up -d
```

Adds [Unleash](https://www.getunleash.io/) (open-source feature flag
service), reachable at `flags.<DOMAIN>` via Caddy. Backs the deployment-wide
flags the api reads at runtime (`SOCIAL_ENABLED`, `REGISTRATION_ENABLED`, and
the per-domain `MAINTENANCE_<DOMAIN>` flags) instead of a baked-in env var, so
they can be flipped from Unleash's UI without a redeploy. Shares the app's
own Postgres instance rather than running a dedicated database container —
see the top comment in `docker-compose.unleash.yml` for the one-time manual
step required on an already-running instance. Gated by Unleash's own login
only (default `admin`/`unleash4all` on first visit — change it immediately);
its open-source edition has no OIDC support, so unlike Grafana/GlitchTip/
Portainer this can't sit behind Authelia as true SSO (nor Authelia's
`forward_auth`, unlike Umami/Homepage — see the top comment in
`flags/unleash.caddy`).

The web additionally polls Unleash's built-in Frontend API directly from the
browser (`unleash-proxy-client`,
`apps/web/src/lib/feature-flags-live.svelte.ts`'s `liveFlags`) — no separate
Unleash Proxy/Edge needed, the Frontend API ships in `unleash-server` itself.
This is the **default way to gate a new feature** on the web: call
`liveFlags.isEnabled("MY_FLAG")` from a reactive context and it updates
without a page reload, no wiring needed anywhere else — that's how
`MAINTENANCE_<DOMAIN>` works (see `isDomainEnabled` in `domains.ts`). Requires
the web's origin to be allowed in Unleash's **Admin settings > Access control

> CORS origins** (your production domain, plus `http://localhost:5173` if you
> also want this working against the hosted instance from local dev — see
> `UNLEASH_API_URL`/`PUBLIC_UNLEASH_FRONTEND_URL` in `.env.example` for pointing
> `apps/api/.env` at a remote Unleash instead of running one locally).

One limitation to design around: the Frontend API only reports _enabled_
flags, so it can't tell "flag not created yet in Unleash" apart from
"explicitly off" — fine for a kill-switch-style flag (off by default), not
for one that should default to _on_ until disabled. `SOCIAL_ENABLED`/
`REGISTRATION_ENABLED` need that on-by-default fallback, so they stay
relayed through `GET /api/config` instead (bootstrap-only, refreshed on the
next page load) — see `isSocialEnabled`/`isRegistrationEnabled` for that
pattern if a future flag needs the same.

**Migrating `SOCIAL_ENABLED`/`REGISTRATION_ENABLED` onto Unleash on an
already-running instance**: Unleash creates a new flag **disabled** by
default. Before that flag exists and is turned on in Unleash, `isEnabled()`
still falls back to the env var (see `FeatureFlagsService`) — safe. But once
you create `SOCIAL_ENABLED` (or `REGISTRATION_ENABLED`) in Unleash's UI, it
becomes authoritative immediately, even OFF by default — so create it and
flip it on in Unleash _before_ removing the env var from `.env`, not after,
or the feature goes dark for however long that gap lasts.

**Cloudflare Access in front of `flags.<DOMAIN>` (same gotcha as
Grafana/UptimeRobot above, worse impact):** putting the whole Unleash app
behind Access breaks feature flags outright, not just monitoring — both the
api's server-side SDK (`UNLEASH_API_URL`, hitting `/api/client/features`,
whether that's this deployment's own api over Docker or a dev machine
pointed at the remote instance) and the browser's live Frontend API
(`PUBLIC_UNLEASH_FRONTEND_URL`, hitting `/api/frontend/*`) get Access's HTML
login page back instead of JSON — the client logs `Unexpected token '<' ...
is not valid JSON` and every flag falls back to its hardcoded default. Both
of these endpoints already carry their own token
(`UNLEASH_API_TOKEN`/`PUBLIC_UNLEASH_FRONTEND_TOKEN`), so they don't need
Access's login on top. Fix: scope the Access application to the admin UI
only — add a **bypass** policy (Include: Everyone) for the paths
`/api/client/*` and `/api/frontend/*`, leaving every other path (the login
screen and admin UI) behind Access as before.

### Landing page (optional)

Add `docker/docker-compose.authelia.yml` and `docker/docker-compose.homepage.yml`
to `COMPOSE_FILE` (see "Combining add-ons" above), then:

```sh
docker compose pull
docker compose up -d
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

The "Statistiques" tile reads `GET /api/public-stats/summary`
(`apps/api/src/admin/public-stats.controller.ts`) — a small dedicated
endpoint, deliberately not the full `/admin/stats` page's `getStats()`,
which computes cohorts/retention curves too heavy to run on every ~10s
widget poll. Four cheap `count()` queries in parallel: total users, total
`LibraryEntry` rows (media tracked across every domain), open `Report`s
(moderation queue), and new signups in the last 7 days. Gated by a shared
secret (`HOMEPAGE_STATS_API_KEY` in `.env`, sent as a bearer token) rather
than the app's normal JWT login, since Homepage has no user session —
generate any long random string, the endpoint fails closed (unreachable,
not just widget-less) if it's unset. It's used here rather than
`@nestjs/terminus`'s `/health` (still what Docker's own healthcheck uses,
untouched) because Terminus's response always includes an `error` object
field (`{}` when healthy), and Homepage's customapi widget crashes outright
trying to render that as a React child (error #31) — happened live, even
after mapping and remapping that field away. `public-stats/summary` is
plain strings/numbers end to end, no such risk. The App tile itself has no
widget at all — a lone "Statut" field it had before added no information
the tile's own link and Docker's healthcheck don't already cover. Authelia's
tile lives in `bookmarks.yaml`, not the main service tiles — nothing to
manage there day-to-day, kept only as a visible reminder the dashboards sit
behind SSO. `bookmarks.yaml` also has a "recent error logs" deep link
straight into Grafana Explore's Loki view (last hour, every container) —
the single most fragile link on the page, since Grafana's Explore URL
format is version-specific and has changed before; falls back to opening
Grafana normally if it ever breaks.

A "DB" tile shows total database size and row count, straight from
Prometheus/postgres_exporter's default metrics (`pg_database_size_bytes`,
`pg_stat_user_tables_n_live_tup`) — this deliberately isn't in the app's own
`/admin/stats` "Système" section (moved out on purpose: it's infrastructure
monitoring, not Loomkeep business data, and doesn't need a query running on
every admin page load).

Development-loop visibility that has nothing to do with the app itself
lives in two tiles: "Déploiement" (the deployed build's git SHA next to
GitHub's latest `main` commit — eyeball the two, no computed diff, that'd
mean the API calling GitHub's own API just to compare itself — and the last
successful `deploy.yml` run) and "Pull requests & issues" (open counts via
GitHub's search API, `?q=repo:...+is:pr+is:open` / `is:issue+is:open`, a
bare `total_count` instead of paginating the full list). Each stacks its
API calls via Homepage's `widgets:` (plural) key, which always renders
vertically — confirmed against Homepage's `item.jsx` source, no config
makes separate stacked widgets sit side by side, only fields that share one
`mappings` list on one API call do (that's why a single widget's own
multiple fields, like VPS's CPU/RAM/Disque, do render in a row). Getting
these five GitHub numbers on one row would need a small proxy combining
three different endpoints server-side into one JSON response first — more
machinery than it's worth here. "Qualité" similarly stacks two independent
API calls (Codecov's coverage, and the public
`api.securityscorecards.dev` JSON endpoint — same source as the README's
OpenSSF badge — for the Scorecard number), so it's a two-row stack too, not
a two-across row.

Dependabot alerts and CodeQL code-scanning alerts get their own tiles —
each a `dynamic-list` widget (a handful of alert rows) capped at 5 visible
rows, plus a second stacked widget hitting the same URL again with
`per_page=100` and a `format: size` mapping (no `field`, so it measures the
root array's length) to show a "Total" count. That duplicate request is the
only way to get a count next to a `dynamic-list` — Homepage doesn't let one
widget be both a list and expose a plain count field — and the total is
itself capped at 100 (GitHub's own per-page max): if it ever reads exactly
"100" there may be more. GlitchTip's tile does the same trick against its
own API (capped at `limit=100` there instead). No severity sort on Code
scanning: GitHub's alerts API only sorts by `created`/`updated` (checked
against GitHub's own REST docs), and Homepage's dynamic-list has no
client-side sort option either — rows are in whatever order GitHub returns
them (newest first). Both Dependabot and code-scanning need a token even on
a public repo (confirmed against GitHub's own docs) — a fine-grained PAT
scoped to just this repo, with **both** "Dependabot alerts: read-only" and
"Code scanning alerts: read-only" permissions (gated independently despite
sharing one Security tab), set as `HOMEPAGE_GITHUB_TOKEN` and reused across
every GitHub-hosted tile for the higher authenticated rate limit (5000/h vs
60/h).

All of the above is split across five `services.yaml` groups (Loomkeep,
Infrastructure, GitHub & qualité, Emails, Alertes — Brevo has nothing to do
with the repo, so it doesn't live in "GitHub & qualité" despite being
tracked alongside it during this page's early iterations), each rendered
with Homepage's own default tile styling. A dark/monospace/hairline full
reskin was tried and reverted: Homepage's tile markup is fixed (icon + name

- description + a stats row), so no amount of CSS made it look like a
  hand-designed page, and `color: teal` in `settings.yaml` turned out to tint
  the entire page background rather than just accents. `color: slate`
  (neutral) is what's running; the only surviving `custom.css` rule is a
  single `margin-bottom` on `.services-group` so collapsed groups don't sit
  flush against each other. Every group except Alertes sets `style: row` in
  `settings.yaml`'s `layout` (tiles side by side instead of Homepage's
  default one-per-line stack — `columns` alone silently does nothing without
  `style: row`, confirmed against Homepage's own source); Alertes stays at
  the default stack since its three tiles are alert lists that need full row
  width, not a cramped side-by-side column. Loomkeep's three tiles are
  ordered App, Statistiques, Admin (not alphabetically) so its 2-column row
  places Admin directly under App and Statistiques on the right — Homepage's
  grid has no per-tile row-span, so ordering into the row-major grid fill is
  the only lever. Groups also get an icon (`layout.<name>.icon`, same
  `mdi-`/`si-`/`sh-`/URL resolution as a service's own `icon:` — undocumented
  but real, found by reading `group.jsx`; a literal emoji does **not** work
  there or on a service icon, it falls through to a broken image, confirmed
  against `resolvedicon.jsx`). Homepage's block-highlighting feature
  (`widget.highlight`, colors a value red/amber/emerald past a threshold) is
  wired up on Healthchecks (up green / down red), UptimeRobot (sitesUp green
  / sitesDown red), Portainer (running green / stopped red), and VPS's
  CPU/RAM/Disque (green under 33%, amber 33–66%, red above) — all native or
  `prometheusmetric` widgets. It's explicitly **not** supported on
  `customapi` widgets per Homepage's own docs, which rules it out for
  Brevo/Déploiement/Pull requests & issues/Qualité/GlitchTip/Dependabot/Code
  scanning/Statistiques — no coloring, no workaround, on any of those.
  VPS/Healthchecks/UptimeRobot/Portainer's thresholds are otherwise
  unverified live (VPS especially: highlighting isn't documented either way
  for `prometheusmetric`, only called out as unsupported for `customapi`).
  There's also no group-level "total alerts across every tile" number —
  Homepage has no group-wide computed aggregate, only per-service widgets.

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

6. With `docker/docker-compose.authelia.yml` (and whichever of observability/
   Portainer/GlitchTip you use) already in `COMPOSE_FILE` (see "Combining
   add-ons" above), bring the stack up, then do the two integrations that
   can't be done through config alone:

   ```sh
   docker compose pull
   docker compose up -d
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
