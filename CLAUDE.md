# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm install                                   # workspace-wide
pnpm dev                                       # api on :3000 + web on :5173 (parallel)
pnpm build                                     # builds packages/* first, then apps/*
pnpm --filter @loomkeep/shared build          # REQUIRED after any change in packages/shared
                                               # (api and web consume its dist/, not its sources)

# API
pnpm --filter @loomkeep/api test              # unit tests (jest)
pnpm --filter @loomkeep/api exec jest src/catalog/providers/tmdb.provider.spec.ts   # single file
pnpm --filter @loomkeep/api test:e2e          # full API flow; needs the dev Postgres running
pnpm --filter @loomkeep/api exec prisma migrate dev --name <name>   # after editing schema.prisma

# Web
pnpm --filter @loomkeep/web check             # svelte-check (type errors in .svelte files)

# Self-host stack
docker compose up -d --build                   # db + api + web (see .env.example)

# Mobile access (phone testing) — docker-compose.ngrok.yml is an OVERRIDE, not
# standalone: it has no build context of its own (only `environment:` blocks +
# the Caddy service), so it ALWAYS needs the base file passed alongside it.
docker compose -f docker-compose.yml -f docker-compose.ngrok.yml up -d --build
ngrok start loomkeep --config ngrok.yml        # separate process; domain from ngrok.yml (gitignored,
                                                # copy from the example, needs NGROK_DOMAIN in .env too)
```

**Git hooks (husky, `.husky/`):** `pre-commit` runs `lint-staged`, which
auto-fixes and formats staged files (`eslint --fix` for js/ts/svelte —
formatting is itself an ESLint rule via `eslint-plugin-prettier`, so this one
step covers both; `prettier --write` for json/md/css/yaml) and re-stages them.
**Formatting is handled by this hook — don't run `pnpm format` by hand before
committing, it's redundant and the hook will re-touch the files anyway.**
`pre-push` runs the heavier gate once per push: `pnpm build:package && pnpm
lint && pnpm --filter @loomkeep/web check` (unit tests and e2e are left to
CI's `lint-build-test`/`e2e` jobs — running them again locally on every push
just duplicates that gate). `knip` (dead code / unused dependency detection) is available via
`pnpm knip` but isn't wired into a hook — run it on demand.

Dev database: Docker container `loomkeep-dev-db`, Postgres 17 on port **5433**
(5432 is taken by an unrelated project on this machine). Connection string lives
in `apps/api/.env` (copy from `.env.example`). e2e tests reuse that server but
run in an isolated `e2e` schema (see `apps/api/test/global-setup.js`), so they
never touch dev data.

`TMDB_API_TOKEN` empty means movie/series search fails at runtime; anime
(AniList) needs no key. Unit tests stub all HTTP, so they always pass offline.

## Architecture

pnpm monorepo, 100% TypeScript: `apps/api` (NestJS + Prisma + PostgreSQL),
`apps/web` (SvelteKit PWA), `packages/shared` (DTOs/enums used by both).

**The database is an on-demand cache, not a catalogue mirror.** Searching hits
TMDB/AniList live and persists nothing. A `MediaItem` (with its `Season`s,
`Episode`s and `MediaExternalId`s) is created only when a user first references
the media — the single entry point is `MediaItemService.upsertFromSource()`
(`apps/api/src/catalog/media-item.service.ts`), called by `LibraryService` on
entry upsert. Refreshes are throttled by `lastSyncedAt` (24h TTL) and never
delete seasons/episodes, so `EpisodeWatch` rows always keep a valid target.

**Catalogue providers** (`apps/api/src/catalog/providers/`) implement a common
`CatalogProvider` interface. TMDB serves MOVIE/SERIES, AniList serves ANIME.
TMDB movie and TV IDs live in separate namespaces, so every details/upsert call
carries a `MediaType`; AniList implies ANIME (see `resolveType` in
`catalog.controller.ts`). AniList has no per-episode listing: episodes are
generated 1..N as a single season, titles from `streamingEpisodes` when
available.

**External IDs are multi-source** (`MediaExternalId`: TMDB, ANILIST, TVDB,
IMDB) — TVDB is deliberately captured from TMDB responses because the planned
TV Time import (roadmap P1.5) reconciles through TVDB IDs. The user's TV Time
GDPR export sits in `C:\Users\logan\Downloads\gdpr-data\` (CSV). The import
must be interactive: ask the user collection by collection what to keep.

**Watch model:** one `EpisodeWatch` row per viewing — rewatches are additional
rows, never an update. Progress (computed in `LibraryService.computeProgress`)
counts distinct watched episodes and excludes season 0 (TMDB specials).

**Auth:** access JWT (15 min) + rotating refresh tokens, one `RefreshToken` row
per device, SHA-256 hashed. `JwtAuthGuard` is registered globally in
`app.module.ts`; opt out with `@Public()`. Handlers read the user from
`@CurrentUser()` (JWT payload, `sub` = user id). `User.entitlements` (Json) is
the open-core seam — unused in MVP, don't remove it.

**Shared enums** (`packages/shared/src/enums.ts`) are `as const` objects, not
TS enums, and Prisma declares parallel enums with identical values in
`schema.prisma`. They must stay in sync; boundaries cast (`source as
DbExternalSource`) rather than map.

**Web app runs as SPA** (`export const ssr = false` in `+layout.ts`): tokens in
localStorage, auto-refresh-and-retry on 401 in `src/lib/api/client.ts`, auth
state via Svelte 5 runes in `src/lib/auth.svelte.ts` (runes mode is forced in
`vite.config.ts`, which also holds the SvelteKit + PWA config — there is no
`svelte.config.js`). API base URL comes from `PUBLIC_API_URL`
(`$env/dynamic/public`, resolved at server start, Docker-friendly).

**Data fetching**: most of the app still calls the domain-specific `request()`
wrappers under `src/lib/api/*` directly from a component's own `$effect` and
local `$state` — no shared cache. `@tanstack/svelte-query`
(`src/lib/queryClient.ts`, `QueryClientProvider` wraps the tree in the root
`+layout.svelte`) was added for the comments feature (P4) as the app's first
shared query/cache layer — `CommentThread.svelte` is the reference
implementation (`createInfiniteQuery`, `createMutation`,
`queryClient.invalidateQueries`, `refetchInterval: 5000` with
`refetchIntervalInBackground: false` rather than a websocket). Reach for it,
not another local-`$state` pattern, when a mutation needs to invalidate data
shown in more than one component.

**Docker:** both Dockerfiles copy _all_ workspace `package.json` manifests plus
`tsconfig.base.json` before `pnpm install --frozen-lockfile` (a frozen install
validates every importer in the lockfile). The api image runs
`prisma migrate deploy` at boot; the web runtime image ships only the
self-contained adapter-node `build/` output. **`.github/workflows/deploy.yml`
auto-redeploys on every successful CI run on `main`** via a plain
`docker compose up -d --build` (no `-f` flags) — which override files get
combined comes from `COMPOSE_FILE` in the VPS's own `.env` (Compose reads
this itself), not from the workflow. Adding a new optional
`docker-compose.<addon>.yml` that should run continuously in production means
updating that `COMPOSE_FILE` line (see `.env.example`), not `deploy.yml`.

**Logging (Observability Palier 1):** `nestjs-pino` (`main.ts` /
`common/logger.config.ts`) replaces Nest's console logger with structured
JSON — pretty-printed only when `NODE_ENV=development` (never true inside
Docker, so the built image always logs JSON; same `isDev` check `main.ts`
already used for gating Swagger). Level via `LOG_LEVEL`
(fatal/error/warn/info/debug/trace/silent), default debug in dev / info
otherwise. `Authorization`/`Cookie`/`Set-Cookie` are redacted; request bodies
are never logged (pino-http's default `req` serializer already excludes them
— don't add a custom one that includes it). A global `AllExceptionsFilter`
(`common/all-exceptions.filter.ts`, `APP_FILTER`) logs every thrown
exception — 5xx at "error" with the stack, 4xx (`NotFoundException`,
`ConflictException`, etc. — the app rejecting a request on purpose) at "warn"
so real bugs aren't buried — then always delegates to
`BaseExceptionFilter.catch()`, so the response sent to the client is
completely unchanged. Docker log rotation (`max-size: 10m`, `max-file: 5`)
is set per service in `docker-compose.yml`/`docker-compose.prod.yml`/
`docker-compose.ngrok.yml` (duplicated by hand in the two overrides — Compose
doesn't merge YAML anchors across `-f` files). **Palier 2** (searchable log
history + metrics) is `docker-compose.observability.yml`, an optional
override adding Grafana + Loki + Promtail (logs) and Prometheus +
node_exporter + postgres_exporter (host/DB metrics) — config in
`observability/`. Promtail auto-discovers every container via the Docker
socket and ships its already-rotated json-file logs into Loki; both Loki and
Prometheus are pre-provisioned as Grafana data sources
(`observability/grafana-datasources.yaml`). Grafana is reachable both
publicly at `grafana.<DOMAIN>` via Caddy (`observability/grafana.caddy`,
gated by Grafana's own login only, no basic auth — Logan's call) and via
`127.0.0.1:3001` as an SSH-tunnel fallback — see README "Logs and
monitoring". Promtail is deprecated upstream (merged into Grafana Alloy) and
is planned to be replaced by it, likely taking node_exporter/postgres_exporter's
job too at the same time. **Palier 3** (`docker-compose.glitchtip.yml`) adds
GlitchTip — a self-hosted, Sentry-API-compatible error tracker, run in
`SERVER_ROLE: all_in_one` mode with its own dedicated Postgres + Valkey
(deliberately not sharing the app's `db`, same reasoning as Loki/Grafana's
own storage). Reachable at `glitchtip.<DOMAIN>`, same
public-with-own-login-no-basic-auth pattern as Grafana/Portainer. Email
alerts (new-error/regression notifications) are opt-in via
`GLITCHTIP_EMAIL_URL` — not auto-derived from the app's own SMTP config
because GlitchTip's `EMAIL_URL` is parsed as a plain URL and the app's Brevo
`SMTP_USER` contains a literal `@` that breaks that unescaped. The app
reports to it via the standard Sentry SDKs (GlitchTip is Sentry-API-
compatible) — `@sentry/node` in `apps/api/src/instrument.ts` (imported first
in `main.ts`, `Sentry.captureException` called from `AllExceptionsFilter`
only for 5xx, matching its existing warn/error log split) and
`@sentry/sveltekit` in `apps/web/src/hooks.client.ts`. Both are gated on
their DSN env var (`GLITCHTIP_API_DSN` / `PUBLIC_GLITCHTIP_WEB_DSN`) being
set, which only happens in the production Docker deployment — empty
disables reporting, same convention as every other optional integration.
Errors only: no tracing on the web side, no session replay (GlitchTip drops
those events silently), no source-map upload yet (`@sentry/cli`'s postinstall
is explicitly declined in `pnpm-workspace.yaml`'s `allowBuilds`). A separate
optional override, `docker-compose.portainer.yml`, adds a Docker management
UI at `portainer.<DOMAIN>` (same pattern).

**P4 social** (`apps/api/src/social/`, `reviews/`, `comments/`, `reports/`) is
gated behind the runtime `SOCIAL_ENABLED` env var, read by the web via
`GET /api/config` (`RuntimeConfigModule`) — self-host defaults to off, the
hosted/ngrok build turns it on (see `docker-compose.ngrok.yml`).
`SocialFeatureGuard` 404s every social route when off (never 403 — a
self-host install shouldn't even advertise the surface exists). Visibility is
two layers: `User.profileAccess` (PUBLIC/PRIVATE/GHOST) acts as a cap over a
per-domain, per-facet `VisibilitySetting` audience (LIBRARY/ACTIVITY facets,
NONE/FRIENDS/PUBLIC). `Follow` is the single relationship primitive (a
directed edge; friend = reciprocal _accepted_ follow, no separate friendship
table); `Block` is a hard cut, checked via `VisibilityService.getRelation`
everywhere a viewer reads another user's data. Content stays split into three
registers, never conflated: private `notes` (plain text, never leaves the
server), `Review` (mandatory /10 rating + optional text + explicit audience —
the single source of truth for ratings; entry `rating` columns were removed
and are now projected from `Review` via `ReviewService.getRatings`), and
`Comment` (threaded discussion, flat + one reply level, soft-deleted with a
tombstone so replies stay attached — targets a work or, for TV/anime, one of
its seasons/episodes via `CommentTargetType`, the same shape as
`ReviewTargetType`). `ActivityEvent` is a materialised, append-only feed log —
two read surfaces, the home feed (followed users' milestones only) and a
user's full profile timeline. `Report` is a polymorphic moderation target
(`ReportTargetType`: COMMENT/REVIEW/USER, only COMMENT actually wired yet)
feeding the admin `/admin/reports` queue. GHOST ("Figurant", ghost/incognito
mode) is fully behavioural: switching to it immediately removes incoming
followers, cancels outgoing follows/requests toward non-public profiles, and
downgrades shared lists to Privé (behind a confirmation modal showing live
counts), and their comments/reviews render under a pseudonym derived at
render time (`social/pseudonym.util.ts`, zero storage) instead of their real
identity — moderation (`/admin/reports`) still sees the real identity. A
Figurant can't follow a non-public profile, share a list, or be `@mentioned`.
Blocking a Figurant from within a comment (they have no visitable profile) is
a known, not-yet-built gap.

## Conventions

- UI strings are French; code, comments and commit messages are English.
- New runtime deps: prefer none — HTTP calls use global `fetch` (Node ≥22).
  pnpm blocks dependency build scripts by default: allow-list them in
  `pnpm-workspace.yaml` (`allowBuilds`) when a package needs a postinstall.
  One exception so far: `@tanstack/svelte-query` (web only) — see "Data
  fetching" above. Ask before adding another.
- Roadmap (README): P1 MVP ✓ → P1.5 TV Time import ✓ → P2 push/Capacitor
  (Web Push ✓, self-host mobile access via PWA + ngrok ✓, native Capacitor
  TODO) → P3 games & books ✓ → P4 social ✓ (all 7 increments shipped:
  foundation/visibility, reviews, activity feed, comments, lists,
  Figurant/ghost mode) → **P5 hosted/entitlements (not started)**.
  Don't implement ahead of the current phase.
- Versioning: no tagged releases, so the `version` field (root + every
  `apps/*`/`packages/*` package.json, kept in lockstep) is the only record of
  where the app stands. Bump the minor version whenever a roadmap phase above
  advances or a domain/module ships (e.g. 0.1.0 → P1, 0.2.0 → P1.5, 0.3.0 →
  P2, 0.4.0 → P3, 0.5.0 → P4 foundation/reviews, 0.6.0 → P4 activity
  feed/comments, 0.7.0 → P4 lists); patch for smaller fixes/polish once past
  1.0. Add an entry to `CHANGELOG.md` for each version bump. Reserve 1.0.0 for
  when the roadmap reaches P4+ and the app is stable enough to call finished,
  not a specific commit.
- Mobile: the app installs as a PWA. `docker-compose.ngrok.yml` + `Caddyfile`
  put web+api behind one origin and expose it via ngrok for phone access (set
  `NGROK_DOMAIN` in `.env`); see README "Mobile access". Single-user; a 2nd
  user means moving to a public host (VPS/PaaS).
- Before adding a new Svelte component, check `apps/web/src/lib/components/`
  (shared) and any route-local `components/` folder for one that already
  covers the need — extend or reuse it rather than writing a new one from
  scratch.
- Visual identity ("Séance" — fonts, palette, nav pattern): see
  `apps/web/DESIGN.md`.
