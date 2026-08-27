# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands you will need sometimes

```sh
pnpm dev                                       # api on :3000 + web on :5173 (parallel)
pnpm test                                      # runs all tests
pnpm build:package                             # REQUIRED after any change in packages/shared
                                               # (api and web consume its dist/, not its sources)

# API
pnpm --filter @loomkeep/api exec jest src/catalog/providers/tmdb.provider.spec.ts   # test single file
pnpm --filter @loomkeep/api test:e2e           # full API flow; needs the dev Postgres running
pnpm --filter @loomkeep/api exec prisma migrate dev --name <name>   # after editing schema.prisma

# Tools
pnpm lint                                      # global eslint + prettier
pnpm lint:fix                                  # global auto-fix lintable issues (js/ts/svelte)
pnpm knip                                      # global dead code / unused dependency detection
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
**Never lint, format, or typecheck yourself, at any point in a task —
mid-edit or as a final pass.** That means no `pnpm lint`, `pnpm lint:fix`,
`pnpm --filter @loomkeep/web check`, bare `tsc`, or running `pnpm
build:package` just to see if it type-errors. The hooks above already cover
every one of these — `pre-commit` formats and lints on every commit,
`pre-push` typechecks the whole project — so running them yourself only
duplicates that gate and burns time for nothing. Same for tests: CI runs the
full suite plus e2e on every PR, so don't run tests as a reflex after every
batch of edits. Judge whether the change is substantial enough to plausibly
break something — a style tweak, a Paraglide message wording change, or a
variable/route rename almost certainly isn't and needs no test run; new or
changed logic, a refactor touching control flow, or a bug fix does. When a
run is warranted, prefer a _targeted_ spec over the whole suite.

## Architecture

**Product model:** Loomkeep has two destinations — the public
instance Logan runs on his own VPS (`deploy.yml`, no setup required), and
self-hosting via the `docker/` compose stack. A premium plan is
planned for the future on **both**: extra features gated behind it on the
hosted instance, and — undecided — possibly some features gated behind it
for self-hosters too. This is the reason `User.entitlements` exists (see
below).

pnpm monorepo, 100% TypeScript: `apps/api` (NestJS + Prisma + PostgreSQL),
`apps/web` (SvelteKit, PWA), `packages/shared` (DTOs/enums used by both).

Dev database: Docker container `loomkeep-dev-db`, Postgres 18 on port **5433**.
Connection string lives in `apps/api/.env` (copy from `.env.example`).
e2e tests reuse that server but run in an isolated `e2e` schema (see `apps/api/test/global-setup.js`),
so they never touch dev data.

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
The open-core positioning (premium as a managed service on top of the AGPL
code, self-hosting included, gating by thresholds rather than hidden features)
is decided in [docs/adr/0001-open-core-agpl.md](docs/adr/0001-open-core-agpl.md).

**Shared enums** (`packages/shared/src/enums.ts`) are `as const` objects, not
TS enums, and Prisma declares parallel enums with identical values in
`schema.prisma`. They must stay in sync; boundaries cast (`source as
DbExternalSource`) rather than map.

**Route layout — the app lives under `/app`, the public site at the root.**
`routes/+page.svelte` is the marketing landing page and `routes/legal/*` the
legal documents; both are **prerendered** (`prerender = true`) so they're
indexable and paint without the bundle. Everything a signed-in user touches
sits under `routes/app/` (`/app`, `/app/media`, `/app/settings`, `/app/admin`,
`/app/u/:username`…). Auth is enforced by **layout nesting, not a route
allowlist**: `app/+layout.svelte` redirects to `/login` when there's no
session and owns the app chrome (sidebars, notification bell, polling), while
`(auth)/+layout.svelte` (login/register/forgot/reset — URLs stay at the root)
does the mirror redirect to `/app`. `(verification)/` holds the two
email-verification screens, reachable signed in _or_ out. Adding a screen
under `app/` gates it automatically — never reintroduce a `PUBLIC_ROUTES`
array. The one-shot session+config bootstrap lives in
`src/lib/bootstrap.svelte.ts`; the three nested layouts gate their render on
its `ready` flag, which is why the root layout must stay SSR-safe.

**Signed-in routes run as SPA** (`export const ssr = false` in
`app/+layout.ts`, `(auth)/+layout.ts` and `(verification)/+layout.ts` — _not_
the root layout, which would kill the landing page's prerender): tokens in
localStorage, auto-refresh-and-retry on 401 in `src/lib/api/client.ts`, auth
state via Svelte 5 runes in `src/lib/auth.svelte.ts` (runes mode is forced in
`vite.config.ts`, which also holds the SvelteKit + PWA config — there is no
`svelte.config.js`). API base URL comes from `PUBLIC_API_URL`
(`$env/dynamic/public`, resolved at server start, Docker-friendly). The API
also emits web paths (push/notification `url`, `href` on activity and report
rows, email links) — those carry the `/app` prefix, so grep `/app/` in
`apps/api/src` before changing a client route.

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

- Code, comments and commit messages are English.
- UI is French-first, but i18n-ready with `paraglide`, so don't hardcode French
  strings in the code — use `m()` instead.
- New runtime deps: prefer none — HTTP calls use global `fetch` (Node ≥22).
  pnpm blocks dependency build scripts by default: allow-list them in
  `pnpm-workspace.yaml` (`allowBuilds`) when a package needs a postinstall.
  One exception so far: `@tanstack/svelte-query` (web only) — see "Data
  fetching" above. Ask before adding another.
- Versioning: no tagged releases, so the `version` field (root + every
  `apps/*`/`packages/*` package.json, kept in lockstep) is the only record of
  where the app stands — currently past 1.0. Bump minor when a feature domain
  ships (a new module, a significant capability), patch for smaller
  fixes/polish. Use the `version-bump` skill (`.claude/skills/version-bump/`)
  to do the bump — it covers the CHANGELOG.md + Quackback changelog ritual.
  Quackback's changelog is the only user-facing release notes page, and
  **publishing an entry there automatically sends the release newsletter**,
  so that step always needs Logan's go-ahead.
- **Feedback board (Quackback)**: user feedback lives at
  feedback.loomkeep.app (self-hosted, MCP tools
  `mcp__quackback__*`/REST API). Three boards: **Feature Requests** and
  **Bug Reports** (both public) for user-facing asks, **Internal Roadmap**
  (team-only) for business-sensitive backlog (monetization, ops, security
  rationale) that must never land on a public board. Two matching roadmaps
  (**Roadmap**, public; **Internal Roadmap**, private) group posts by
  board — when creating a post, always add it to the roadmap matching its board
  in the same pass (no server-side automation for this, it's a manual step
  every time).
  Note: the REST API silently ignores `audience`/`isPublic` on board/roadmap
  **creation** (always defaults public) — set it via a follow-up `PATCH`
  instead. Also: Cloudflare blocks Python's default `urllib` User-Agent on
  this domain (opaque "error code: 1010") — pass an explicit `User-Agent`
  header, or use `curl`.
- Before adding a new Svelte component, check `apps/web/src/lib/components/`
  (shared) and any route-local `components/` folder for one that already
  covers the need — extend or reuse it rather than writing a new one from
  scratch.
- The app can be installed as a PWA — check the mobile viewport (not just desktop)
  on every `apps/web` UI change.
- Visual identity ("Séance" — fonts, palette, nav pattern): see
  `apps/web/DESIGN.md`.
- When a feature significant enough for a user to notice ships, flag it with
  the "Nouveau" badge (`apps/web/src/lib/feature-badges.ts` `isFeatureNew()` +
  `<NewBadge />`) at its point of discovery (nav entry, settings toggle,
  action button…) — add a `{ key: shippedISODate }` entry to `SHIPPED`. It's
  time-based (21 days from ship date) so it fades on its own.
  Skip it for internal refactors, bug fixes, or anything that doesn't change
  what the user sees/can do.
