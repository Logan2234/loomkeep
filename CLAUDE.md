# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm i                                         # workspace-wide
pnpm dev                                       # api on :3000 + web on :5173 (parallel)
pnpm build                                     # builds packages/* first, then apps/*
pnpm test                                      # runs all tests
pnpm build:package                             # REQUIRED after any change in packages/shared
                                               # (api and web consume its dist/, not its sources)

# API
pnpm --filter @loomkeep/api test               # unit tests (jest)
pnpm --filter @loomkeep/api exec jest src/catalog/providers/tmdb.provider.spec.ts   # single file
pnpm --filter @loomkeep/api test:e2e           # full API flow; needs the dev Postgres running
pnpm --filter @loomkeep/api exec prisma migrate dev --name <name>   # after editing schema.prisma

# Web
pnpm --filter @loomkeep/web check              # svelte-check (type errors in .svelte files)

# Self-host stack — compose files live in docker/, not the repo root.
# pnpm wraps the common combos (see root package.json "scripts"):
# docker:dev, docker:prod, docker:full (all optional add-ons).
pnpm docker:dev                                # db + api + web (see .env.example)

# Tools
pnpm lint                                      # global eslint + prettier
pnpm lint:fix                                  # global auto-fix lintable issues (js/ts/svelte)
pnpm knip                                      # global dead code / unused dependency detection
pnpm spelunk                                   # visualize the dependency graph of the api package
pnpm clean                                     # removes all dist/ and tsbuildinfo files, but keeps node_modules
pnpm clean:dev                                 # like pnpm clean + remove node_modules
```

**Git hooks (husky, `.husky/`):** `pre-commit` runs `lint-staged`, which
auto-fixes and formats staged files (`eslint --fix` for js/ts/svelte —
formatting is itself an ESLint rule via `eslint-plugin-prettier`, so this one
step covers both; `prettier --write` for json/md/css/yaml) and re-stages them.
**Formatting is handled by this hook.**
`pre-push` runs the heavier gate once per push: `pnpm build:package && pnpm
lint && pnpm --filter @loomkeep/web check` (unit tests and e2e are left to
CI's `lint-build-test`/`e2e` jobs — running them again locally on every push
just duplicates that gate). `knip` (dead code / unused dependency detection) is available via
`pnpm knip` but isn't wired into a hook — run it on demand.
**Don't manually run `pnpm lint`/`pnpm --filter @loomkeep/web check` after
every small edit** — the hooks above already cover formatting (pre-commit)
and lint/typecheck (pre-push). When a change spans several planned edits,
implement the whole batch first, then run one check pass — including tests,
which no hook runs — at the end, rather than validating after each step.

Dev database: Docker container `loomkeep-dev-db`, Postgres 18 on port **5433**.
Connection string lives in `apps/api/.env` (copy from `.env.example`).
e2e tests reuse that server but run in an isolated `e2e` schema (see `apps/api/test/global-setup.js`),
so they never touch dev data.

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
IMDB) — TVDB is deliberately captured from TMDB responses because the TV Time
import (`apps/api/src/import/sources/tvtime/`) reconciles through TVDB IDs.
The import is interactive: ask the user collection by collection what to keep.

**Watch model:** one `EpisodeWatch` row per viewing — rewatches are additional
rows, never an update. Progress (computed in `LibraryService.computeProgress`)
counts distinct watched episodes and excludes season 0 (TMDB specials).

**Auth:** access JWT (15 min) + rotating refresh tokens, one `RefreshToken` row
per device, SHA-256 hashed. `JwtAuthGuard` is registered globally in
`app.module.ts`; opt out with `@Public()`. Handlers read the user from
`@CurrentUser()` (JWT payload, `sub` = user id). `User.entitlements` (Json) is
the open-core seam for future paid features — currently unused, don't remove it.

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
`+layout.svelte`) was added for the comments feature as the app's first
shared query/cache layer — `CommentThread.svelte` is the reference
implementation (`createInfiniteQuery`, `createMutation`,
`queryClient.invalidateQueries`, `refetchInterval: 5000` with
`refetchIntervalInBackground: false` rather than a websocket). Reach for it,
not another local-`$state` pattern, when a mutation needs to invalidate data
shown in more than one component.

**Docker:** every `docker-compose.*.yml`, the `Caddyfile`, and the add-on
config dirs (`observability/`, `authelia/`, `homepage/`) live under `docker/`,
not the repo root. `context: ..` in `docker/docker-compose.yml`'s `api`/`web`
build blocks points back up at the monorepo root, since Compose resolves
relative paths against the compose file's own location, not the invocation
cwd. `.github/workflows/deploy.yml` auto-redeploys on every successful CI run
on `main` via a plain `docker compose up -d --build` (no `-f` flags) — which
override files get combined comes from `COMPOSE_FILE` in the VPS's own
`.env`, not from the workflow. The stack also includes optional add-ons
(Grafana/Loki/Prometheus, GlitchTip, Portainer, Authelia SSO, Homepage) — see
[docker/README.md](docker/README.md) for how they fit together.

**Logging:** `nestjs-pino` (`main.ts` / `common/logger.config.ts`) replaces
Nest's console logger with structured JSON (pretty-printed only in
`NODE_ENV=development`, never true inside Docker). Level via `LOG_LEVEL`,
default debug in dev / info otherwise. `Authorization`/`Cookie`/`Set-Cookie`
are redacted; request bodies are never logged. A global
`AllExceptionsFilter` (`common/all-exceptions.filter.ts`, `APP_FILTER`) logs
every thrown exception — 5xx at "error" with the stack, 4xx (the app
rejecting a request on purpose) at "warn" — then always delegates to
`BaseExceptionFilter.catch()`, so the response sent to the client is
unchanged. Errors also report to GlitchTip (self-hosted, Sentry-API-
compatible) via the standard Sentry SDKs, gated on `GLITCHTIP_API_DSN` /
`PUBLIC_GLITCHTIP_WEB_DSN` being set (empty disables reporting) — see
[docker/README.md](docker/README.md) for the full setup.

**Social** (`apps/api/src/social/`, `reviews/`, `comments/`, `reports/`) is
gated behind the runtime `SOCIAL_ENABLED` env var, read by the web via
`GET /api/config` (`RuntimeConfigModule`) — self-host defaults to off, the
public VPS build turns it on. `SocialFeatureGuard` 404s every social route
when off (never 403 — a self-host install shouldn't even advertise the
surface exists). `Follow` is the single relationship primitive across the
whole feature (a directed edge; friend = reciprocal _accepted_ follow, no
separate friendship table) — see
[apps/api/src/social/README.md](apps/api/src/social/README.md) for the
visibility model, content registers, and GHOST/Figurant behaviour.

## Conventions

- UI strings are French; code, comments and commit messages are English.
- New runtime deps: prefer none — HTTP calls use global `fetch` (Node ≥22).
  pnpm blocks dependency build scripts by default: allow-list them in
  `pnpm-workspace.yaml` (`allowBuilds`) when a package needs a postinstall.
  One exception so far: `@tanstack/svelte-query` (web only) — see "Data
  fetching" above. Ask before adding another.
- Versioning: no tagged releases, so the `version` field (root + every
  `apps/*`/`packages/*` package.json, kept in lockstep) is the only record of
  where the app stands — currently past 1.0. Bump the minor version when a
  feature domain ships (a new module, a significant capability), patch for
  smaller fixes/polish. Add an entry to `CHANGELOG.md` for each version bump.
- Before adding a new Svelte component, check `apps/web/src/lib/components/`
  (shared) and any route-local `components/` folder for one that already
  covers the need — extend or reuse it rather than writing a new one from
  scratch.
- The app installs as a PWA — check the mobile viewport (not just desktop)
  on every `apps/web` UI change, especially sticky headers, dropdown/menu
  positioning, action bars, and text that could overflow.
- Visual identity ("Séance" — fonts, palette, nav pattern): see
  `apps/web/DESIGN.md`.
- When a feature significant enough for a user to notice ships, flag it with
  the "Nouveau" badge (`apps/web/src/lib/feature-badges.ts` `isFeatureNew()` +
  `<NewBadge />`) at its point of discovery (nav entry, settings toggle,
  action button…) — add a `{ key: shippedISODate }` entry to `SHIPPED`. It's
  time-based (21 days from ship date, no per-user dismissal state) so it
  fades on its own. Skip it for internal refactors, bug fixes, or anything
  that doesn't change what the user sees/can do.
