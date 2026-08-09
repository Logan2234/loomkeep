# Docker stack — architecture notes

Technical reference for how the compose files, Caddy, and the optional
add-ons fit together. For setup instructions (how to actually stand this up),
see the root [README.md](../README.md) — this file is the "why it's built
this way" companion for whoever edits these configs.

## Layout

Every `docker-compose.*.yml`, the `Caddyfile`, and the add-on config dirs
(`observability/`, `authelia/`, `homepage/`) live under `docker/`, not the
repo root — kept together as a unit so their relative paths to each other
never had to change. `context: ..` in `docker-compose.yml`'s `api`/`web`
build blocks points back up at the monorepo root, since Compose resolves
relative paths against the compose file's own location, not the invocation
cwd. Both Dockerfiles copy _all_ workspace `package.json` manifests plus
`tsconfig.base.json` before `pnpm install --frozen-lockfile` (a frozen
install validates every importer in the lockfile). The api image runs
`prisma migrate deploy` at boot; the web runtime image ships only the
self-contained adapter-node `build/` output.

## Deploy

`.github/workflows/deploy.yml` auto-redeploys on every successful CI run on
`main` via a plain `docker compose up -d --build` (no `-f` flags) — which
override files get combined comes from `COMPOSE_FILE` in the VPS's own
`.env` (Compose reads this itself), not from the workflow. Adding a new
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

## Image vulnerability scanning (Trivy)

`.github/workflows/trivy.yml` — separate from `ci.yml`'s own
`docker-build` job (which only validates the Dockerfiles still build) and
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
`SERVER_ROLE: all_in_one` mode with its own dedicated Postgres + Valkey
(deliberately not sharing the app's `db`, same reasoning as Loki/Grafana's
own storage). Reachable at `errors.<DOMAIN>`, same
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

## User feedback board (`docker-compose.quackback.yml`)

[Quackback](https://quackback.io) — an open-source, self-hostable
alternative to Canny/UserVoice: feedback boards (bugs and feature ideas as
separate boards), voting, a roadmap view and a changelog. Own dedicated
Postgres + Valkey, same reasoning as GlitchTip's own storage — an add-on
shouldn't share a failure domain with the app it's separate from. Uses
Valkey (not Quackback's own docs' suggested Dragonfly) to reuse the
Redis-compatible technology already in this stack rather than adding a
second one for the same job. Reachable at `feedback.<DOMAIN>`, same
public-with-own-login-no-basic-auth pattern as Grafana/Portainer/GlitchTip —
login is email-OTP based, sent through the app's own `SMTP_*` creds
(discrete host/user/pass fields, unlike GlitchTip's single `EMAIL_URL`, so
Brevo's `SMTP_USER` containing a literal `@` isn't an issue here).

S3/MinIO (image uploads in the rich-text editor) is deliberately left
unconfigured — optional per Quackback's own docs, degrades to disabling
image upload rather than failing. Not worth a fourth dedicated service for a
single-user instance; add `S3_*` env vars later if that's ever needed.

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
