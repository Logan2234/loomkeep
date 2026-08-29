# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Loomkeep — self-hosted media tracker (series, movies, anime, games, books,
music, and more to come), open-core under AGPL-3.0. pnpm monorepo: `apps/api`
(NestJS + Prisma + PostgreSQL), `apps/web` (SvelteKit PWA), `packages/shared`
(DTOs/enums — consumed from its built `dist/`, so run `pnpm build:package` after any change
there). Catalogs are queried live (TMDB/AniList/IGDB/Open Library/
MusicBrainz) and nothing is persisted until a user tracks an item — see
"Data model & catalog" below.

Two destinations: Logan's own hosted VPS (auto-deployed, `deploy.yml`) and
self-hosting via `docker/`. A premium plan exists as a seam, not sold yet —
see "Feature flags & entitlements".

## Commands

```sh
pnpm dev                                       # api on :3000 + web on :5173 (parallel)
pnpm test                                      # runs all tests
pnpm build:package                             # REQUIRED after any change in packages/shared

# API
pnpm --filter @loomkeep/api exec jest src/catalog/providers/tmdb.provider.spec.ts   # single test file
pnpm --filter @loomkeep/api test:e2e           # full API flow; needs the dev Postgres running
pnpm --filter @loomkeep/api exec prisma migrate dev --name <name>   # after editing schema.prisma

# Tools
pnpm lint / pnpm lint:fix                      # global eslint + prettier
pnpm check                                     # global typecheck (tsc on api/shared, svelte-check on web)
pnpm knip                                      # dead code / unused dependency detection
```

e2e tests reuse the dev Postgres but run in an isolated `e2e` schema
(`apps/api/test/global-setup.js`), so they never touch dev data.

**Never lint, format, typecheck, or run the test suite yourself as a
verification step, mid-task or at the end.** `pre-commit` (lint-staged)
already formats/lints staged files, `pre-push` already typechecks the whole
repo, and CI runs the full test suite + e2e on every PR — running any of
that yourself only duplicates the gate. Judge whether a change plausibly
broke something before reaching for a test run at all: a style tweak, a
wording change, a rename almost never needs one; new/changed logic or a bug
fix does.

## Architecture

### Data model & catalog

- **On-demand cache, not a mirror.** A `MediaItem`/`GameItem`/`BookItem`/
  `MusicItem` (with children — seasons, episodes, external ids) is created
  only when a user first tracks it, through a single entry point,
  `MediaItemService.upsertFromSource()`. Refreshes are throttled by
  `lastSyncedAt` (24h TTL) and never delete seasons/episodes, so
  `EpisodeWatch` rows always keep a valid target.
- **One provider per domain** (`apps/api/src/<domain>/providers/`): TMDB
  (movies/series) + AniList (anime) share the catalog, IGDB (games), Open
  Library (books), MusicBrainz (music). TMDB movie/TV ids are separate
  namespaces, so every call carries a `MediaType`. AniList has no
  per-episode listing — episodes are generated 1..N.
- `MediaExternalId` is multi-source (TMDB/ANILIST/TVDB/IMDB) — TVDB is
  captured from TMDB responses specifically because the TV Time import
  reconciles through TVDB ids.
- **Watch model**: one row per viewing (`EpisodeWatch`, mirrored by
  `MovieReplay`/`GameReplay`/`BookReplay`) — a rewatch is a new row, never an
  update. `LibraryService.computeProgress` excludes season 0 (TMDB specials).
- **Import sources** (`apps/api/src/import/sources/`) share a base class per
  domain: `MediaImportSource` (TV Time CSV, Trakt account-export ZIP, Simkl
  OAuth) and `BookCsvSource` (Goodreads, StoryGraph) own the common
  analyze/resolve/commit flow — a new source only supplies its parsing.
  Steam implements `ImportReq` directly (no shared base, single source).
  `GET /import/availability` greys out a source when its env key is unset.
- Shared enums (`packages/shared/src/enums.ts`) are `as const` objects
  mirrored by Prisma enums with identical values — cast at boundaries
  (`source as DbExternalSource`), don't write a mapping function.

### Auth & errors

- Access JWT (15 min) + rotating refresh tokens, one `RefreshToken`
  row/device, SHA-256 hashed. `JwtAuthGuard` is global, opt out with
  `@Public()`; `@CurrentUser()` reads `sub` from the JWT payload. TOTP MFA
  layers on top (`auth/mfa.service.ts`).
- Errors are typed codes (`packages/shared/src/error-codes.ts`,
  `ErrorCode.AuthInvalidCredentials`-style, `domain.reason`), thrown via
  `AppException` and caught by the global `AllExceptionsFilter`. The web
  derives the i18n key mechanically from the code
  (`errorCodeToMessageKey()`, `apps/web/src/lib/api/errors.ts`) — never
  display API-supplied text directly; adding a failure mode means adding a
  code here, not a bespoke string.

### Feature flags & entitlements

- `FeatureFlagsService` wraps Unleash with an env/config fallback
  (`isEnabled(flag, default)`) so an unconfigured flag never locks out a
  feature. Web's default gating path is `liveFlags.isEnabled("MY_FLAG")`
  (`apps/web/src/lib/feature-flags-live.svelte.ts`) — reactive, no reload.
  Exception: an on-by-default flag (`SOCIAL_ENABLED`, `REGISTRATION_ENABLED`)
  can't use that path — the Frontend API only reports _enabled_ flags — so
  those stay relayed through `GET /api/config` instead.
- Premium is a seam, not sold yet: enforcement points call
  `EntitlementService.isEffectivelyPremium()`, not the raw `hasPremium()` —
  it's `true` for everyone until the `premium-features` Unleash flag is on
  (no CGV/billing exists yet; positioning in
  [docs/adr/0001-open-core-agpl.md](docs/adr/0001-open-core-agpl.md)).

### Web routing & data fetching

- App lives under `/app`, public site at root (`+page.svelte`, `legal/*` —
  both prerendered). Auth is enforced by **layout nesting, not a route
  allowlist**: `app/+layout.svelte` ↔ `(auth)/+layout.svelte` mirror-redirect
  each other. Adding a screen under `app/` gates it automatically — never
  reintroduce a `PUBLIC_ROUTES` array.
- Signed-in routes run as SPA (`ssr = false` in the `app`/`(auth)`/
  `(verification)` layouts only, never the root). Tokens in localStorage,
  auto-refresh-and-retry on 401 in `src/lib/api/client.ts`. The API itself
  emits `/app`-prefixed paths (push/email links) — grep `/app/` in
  `apps/api/src` before renaming a client route.
- API calls go through three helpers over `@tanstack/svelte-query`
  (`apps/web/src/lib/api/{query,mutation,infinite-query}.svelte.ts`) —
  never a hand-rolled `try/catch` + local `error`/`loading` `$state`.
  `createApiQuery`/`createApiMutation`/`createApiInfiniteQuery` all take a
  _getter_ (`() => ({...})`, not a plain object — TanStack needs to
  re-evaluate the options reactively) and return `{ data, error, loading }`.
  `error` is always a translated string: `resolveApiError()` for the two
  read helpers, `bannerMessage()` for mutations (returns `null` once every
  field it names is already shown under its own input via `fieldError()`).
  A mutation also adds `mutate(args)` (ignored while one's already in
  flight — no hand-rolled double-submit guard needed), `fieldErrors`, and
  `invalidates` (factory keys to refetch on success). `CommentThread.svelte`
  is the one deliberate exception — it needs raw TanStack directly
  (`refetchInterval` polling, its own `createInfiniteQuery`) — don't
  migrate it. Full design and the settled tradeoffs:
  [docs/plans/centralized-api-layer.md](docs/plans/centralized-api-layer.md).
- Query keys come from a factory (`apps/web/src/lib/api/keys.ts`),
  namespaced per domain. TanStack dedupes by key at the single
  `QueryClient` (mounted in `routes/+layout.svelte`) — two components
  requesting the same key share one cache entry, so e.g. a nav badge and
  its detail page stay in sync with no context/DI wiring needed.
  `invalidates` lists only the keys for what's _displayed at the same
  time_ as the mutation, not everything it semantically touches —
  navigating away unmounts a query, and the next mount refetches it if
  stale. When something outside the helpers changes the same data (a
  not-yet-migrated modal calling its own route function), patch the cache
  with `queryClient.setQueryData(key, ...)` rather than reassigning a
  `$derived` value, which isn't a valid assignment target.
- Every paginated `GET` list endpoint shares one contract: `page`/`limit`
  request params (`apps/api/src/common/pagination.util.ts`'s
  `parsePageQuery`), `PagedResult<T>` response
  (`packages/shared/src/dto/pagination.ts`: `{ items, hasMore, total? }`).

### Ops

- `docker/` holds every compose file, the Caddyfile, and add-on configs;
  `context: ..` resolves against the compose file's location, not repo root.
  `deploy.yml` redeploys on every successful CI run on `main` — which
  override files get combined comes from `COMPOSE_FILE` in the VPS's own
  `.env`, not the workflow. See [docker/README.md](docker/README.md) for
  the add-on stack (observability, Authelia SSO, Portainer, GlitchTip,
  Umami, Unleash, Homepage).
- `nestjs-pino` structured JSON logging; `Authorization`/`Cookie`/
  `Set-Cookie` redacted, request bodies never logged. `AllExceptionsFilter`
  also reports to GlitchTip when `GLITCHTIP_API_DSN`/`PUBLIC_GLITCHTIP_WEB_DSN`
  are set.

### Social

Gated behind `SOCIAL_ENABLED` (off by default self-host, on for the hosted
VPS) — `SocialFeatureGuard` 404s (never 403) when disabled, so a self-host
install doesn't advertise the surface exists. `Follow` is the one
relationship primitive (friend = reciprocal accepted follow). Details:
[apps/api/src/social/README.md](apps/api/src/social/README.md).

## Conventions

- Code, comments, commits: English. UI is French-first but i18n-ready via
  Paraglide — use `m()`, never hardcode a string. Sources live in
  `apps/web/messages/{locale}/{common,errors,other}.json`.
- Prefer no new runtime deps (global `fetch`, Node ≥22). pnpm blocks
  postinstall scripts by default — allow-list in `pnpm-workspace.yaml`'s
  `allowBuilds`. Ask before adding one.
- Versioning: the four `package.json` versions (root + each app/package) are
  kept in lockstep — minor for a new module/capability, patch for a smaller
  fix/polish. No tagged releases otherwise. Bump via the `version-bump`
  skill (`CHANGELOG.md` + a Quackback changelog draft) — **publishing that
  draft sends the release newsletter**, so it always needs Logan's go-ahead.
- Feedback lives on Quackback (feedback.loomkeep.app), not GitHub Issues:
  **Feature Requests**/**Bug Reports** (public) vs **Internal Roadmap**
  (private, business-sensitive) — new posts need adding to the matching
  roadmap by hand, no automation for it. Gotchas: the REST API ignores
  `audience`/`isPublic` on board/roadmap creation (`PATCH` after the fact);
  Cloudflare blocks Python's default `urllib` user agent on this domain
  (pass an explicit one, or use `curl`). See `.claude/skills/quackback-ticket`.
- Check `apps/web/src/lib/components/` (and route-local `components/`)
  before writing a new Svelte component — extend or reuse instead.
- Installable as a PWA — check the mobile viewport, not just desktop, on
  every `apps/web` UI change.
- Visual identity ("Séance" — fonts, palette, nav pattern):
  `apps/web/DESIGN.md`.
- Shipping something a user will notice → add a `"Nouveau"` badge entry
  (`apps/web/src/lib/feature-badges.ts`'s `SHIPPED` map, `{ key:
shippedISODate }`) at its point of discovery — it fades on its own after
  21 days. Skip for internal refactors and fixes.
