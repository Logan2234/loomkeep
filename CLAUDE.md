# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Loomkeep — self-hosted media tracker (series, movies, anime, games, books,
music), open-core under AGPL-3.0. pnpm monorepo:

- `apps/api` — NestJS + Prisma + PostgreSQL.
- `apps/web` — SvelteKit PWA.
- `apps/docs` — docs.loomkeep.app (Astro Starlight + a Scalar reference from
  the public API's `openapi-v1.json`). Every field of a public DTO needs a
  JSDoc description and `@example`; `generate:openapi` fails on a gap.
- `apps/mobile` — Capacitor Android shell that loads the instance's `/app`
  rather than bundling the web ([docs/mobile-app-plan.md](docs/mobile-app-plan.md)).
- `packages/shared` — DTOs/enums, consumed from its built `dist/`: run
  `pnpm build:package` after any change there.

Two destinations: Logan's hosted VPS (auto-deployed by `ci.yml`) and
self-hosting via `docker/`.

## Commands

```sh
pnpm dev                                       # api :3000 + web :5173, packages/shared rebuilt on save
pnpm test                                      # all tests
pnpm build:package                             # after any change in packages/shared, outside `pnpm dev`
pnpm dev:docs                                  # docs on :4321 (needs apps/api built + generate:openapi)
pnpm --filter @loomkeep/api exec vitest <file> # single API test file
pnpm --filter @loomkeep/api test:e2e           # full API flow, isolated `e2e` schema of the dev Postgres
pnpm --filter @loomkeep/api exec prisma migrate dev --name <name>
pnpm --filter @loomkeep/web exec vitest --project component
pnpm lint / pnpm check / pnpm knip
```

**Never lint, format, typecheck, or run the test suite yourself as a
verification step.** `pre-commit` formats/lints staged files, `pre-push`
typechecks what changed, and CI runs the lint, test and e2e jobs whose
paths a PR touches (a PR limited to `docker/` or `.github/deploy/` runs
none of them). Run a test only for new/changed logic or a bug fix, not for a style tweak, a
wording change or a rename.

## Architecture

### Data model & catalog

- **On-demand cache, not a mirror.** Catalogs (TMDB + AniList, IGDB, Open
  Library, MusicBrainz — one provider per domain) are queried live. A
  `MediaItem`/`GameItem`/`BookItem`/`MusicItem` is created only when a user
  first tracks it, through its domain's `upsertFromSource()`. Refreshes
  (24h TTL, 7 days for an ended series) never delete seasons/episodes, so
  `EpisodeWatch` rows keep a valid target. Media, games and books also
  re-sync in a 6-hourly `refreshStale` job; music has none, an album only
  refreshes when someone tracks it again. Behaviour the four domains must
  share gets a case in `apps/api/src/common/domain-parity.spec.ts`.
- The Prisma schema is one file per owning API module in
  `apps/api/prisma/schema/` (`games.prisma`…): a new table goes in the file of
  the module that writes it; generators, datasource and enums several files
  share sit in `schema.prisma`.
- TMDB movie/TV ids are separate namespaces: every call carries a
  `MediaType`. TVDB ids are captured from TMDB because the TV Time import
  reconciles through them.
- `MediaEntry.watchedEpisodes`/`lastWatchedAt` and `MediaItem.episodeCount`
  are maintained by Postgres triggers — never write them from the app.
- Import sources share a base class per domain (`MediaImportSource`,
  `BookCsvSource`): a new source only supplies its parsing.
- Shared enums (`packages/shared/src/enums.ts`) mirror Prisma enums with
  identical values — cast at boundaries, don't write a mapping function.
- Prisma's types miss an unknown key in a `select` that also names a valid
  one, and in a `data`: a dropped column only fails at runtime. A query shape
  kept in a constant is written `satisfies Prisma.UserSelect` (or the
  matching `…Include`/`…DefaultArgs`), never `as const`; after moving or
  renaming a column, grep its name across `src` and `test`.
- No repository layer ([docs/adr/0008](docs/adr/0008-no-repository-layer.md)):
  services call Prisma directly. A query shape or query that other modules
  reuse lives in its owner module's `<model>.queries.ts`
  (`users/user.queries.ts`'s `USER_SUMMARY_SELECT`), never one copy per caller.

### Auth & errors

- Access JWT (15 min) + rotating refresh tokens in encrypted `HttpOnly`
  cookies — never localStorage. `JwtAuthGuard` is global, opt out with
  `@Public()`. Personal API keys (`Bearer lk_…`) are accepted only on
  `@AllowApiKey()` routes (the public API, `/api/v1`).
- MFA has three second factors (TOTP, emailed code, WebAuthn): anything
  that asks "has MFA?" (e.g. `AdminGuard`) must count all three. Sensitive
  actions use `@RequireRecentAuth`.
- Errors are typed codes (`packages/shared/src/error-codes.ts`) thrown via
  `AppException`. The web maps each code to an i18n message in
  `apps/web/src/lib/api/errors.ts` — never display API-supplied text; a new
  failure mode means a new code.

### Feature flags, settings & premium

- Unleash flags (`FeatureFlagsService`, web `liveFlags.isEnabled()`) are for
  rollouts and kill switches. The API's take a fallback so an unconfigured
  flag never locks a feature out; the web's are `false` until Unleash says
  otherwise, so a flag on by default goes through `GET /api/config`. Permanent instance configuration lives in the
  `InstanceSettings` table (Admin › Settings, `instanceSetting()`); an env
  var of the same name wins and locks it.
- Premium is a seam, not sold yet: call
  `EntitlementService.isEffectivelyPremium()` (`true` for everyone while
  the `premium-features` flag is off), never `hasPremium()`. Two callers need the
  raw plan and keep `hasPremium()`: `GET /users/me/entitlement` (the web's
  lock state) and `ApiRateLimitService.limitFor` (the API quota must not
  rise for everyone before premium ships).
- A whole premium feature lives in `ee/` (`apps/api/src/ee`,
  `apps/web/src/lib/ee`) under [LICENSE-EE](LICENSE-EE). The API core never
  imports `ee/` (ESLint enforces it): only `app.module.ts` registers
  `EeModule`. Every `ee/` controller carries `EeLicenseGuard` except the
  public `EeStatusController` (`GET /ee/status`, which is how the web learns
  the instance is unlicensed). The web has no such rule: core screens import
  `#lib/ee/…` directly and gate it with `useEeLock()`.

### Web

- App under `/app`, public site at root. Auth is enforced by **layout
  nesting**, not a route allowlist: a screen under `app/` is gated
  automatically. The API emits `/app/…` links (push, email) — grep before
  renaming a client route.
- API calls go through `createApiQuery`/`createApiMutation`/
  `createApiInfiniteQuery` (TanStack, `src/lib/api/`), which take a getter
  and return a translated `error` — never a hand-rolled `try/catch` +
  `loading` state. `CommentThread.svelte` is the one deliberate exception.
- Query keys come from `src/lib/api/keys.ts`. `invalidates` lists only what
  is displayed alongside the mutation.
- Paginated `GET` lists share one contract: `page`/`limit` params
  (`parsePageQuery`), `PagedResult<T>` response. The reading/play
  sessions of an entry (`GET /books|games/entries/:id/sessions`) are the
  exception: `page` only, and a summary DTO with its totals beside
  `items`/`hasMore`.

### Web tests

- Vitest `unit` (plain `*.spec.ts`, Node) and `component`
  (`*.svelte.spec.ts`, happy-dom + Testing Library). Logic that can live in
  a plain `.ts` module is tested there first.
- Test behaviour: query by role/label, expected text from `m.*()`.
- The API is stubbed with msw (`src/lib/test/msw.ts`) — never `vi.mock`
  `#lib/api/*`. Render with `renderWithQuery()`.
- Every component test ends with an axe pass. A new route with a parameter
  needs a value or an exclusion in `.github/web-audit/pages.mjs`.
- No coverage threshold, no snapshot tests.

### Ops & social

- `docker/` holds every compose file; `context: ..` resolves against the
  compose file's location. Which overrides the VPS combines comes from its
  own `.env` (`COMPOSE_FILE`). Logs redact auth headers and never log
  request bodies.
- One API process per instance ([docs/adr/0002](docs/adr/0002-one-api-process.md)):
  imports, throttling, socket.io and the session cache live in memory. A new
  in-memory state adds a row to that ADR. A scheduled job goes through
  `JobRunService.record()`, whose database lock runs it once across replicas
  and returns `JOB_SKIPPED` when it is already running.
- Social features are gated by the `socialEnabled` instance setting;
  `SocialFeatureGuard` answers 404 (never 403) when off.
  [apps/api/src/social/README.md](apps/api/src/social/README.md).

## Conventions

- Code, comments, commits: English. UI is English-first (French, Italian),
  through Paraglide `m()` — never a hardcoded string. A key's prefix decides
  its catalog file (`settings_`, `admin_`, …; `src/catalogs.spec.ts`).
- No new runtime dependency without asking; pnpm blocks postinstall scripts
  unless allow-listed in `pnpm-workspace.yaml`.
- **Versioning**: the six `package.json` versions stay in lockstep — minor
  for a new capability, patch for fixes/polish. Bump with the `version-bump`
  skill, in a PR; merging it is the release (GitHub release, image tags,
  APK). Publishing the Quackback changelog draft sends the newsletter:
  always Logan's go-ahead.
- **CHANGELOG**: every PR with a change someone outside the code would
  notice adds a bullet under `## [Unreleased]` in `CHANGELOG.md`, which
  becomes the release notes. Each bullet must feel like a changelog item:
  one or two lines, what changed, straight to the point — no implementation
  walkthrough. A breaking change (above all for self-hosters: env var,
  default, port, volume, removed route, migration to watch) goes first, in
  its own `### Breaking changes` section, worded as what to do.
- Feedback and roadmap live on Quackback (feedback.loomkeep.app), not
  GitHub Issues — see `.claude/skills/quackback-ticket`.
- API file names: a module file is named after its folder
  (`lists/lists.module.ts`, a second module in it names itself:
  `lists/list-works.module.ts`), and a function turning a row into a DTO
  lives in `<subject>.mapper.ts` (`games/game-item.mapper.ts`).
- Reuse `apps/web/src/lib/components/` before writing a new component.
- Check the mobile viewport on every `apps/web` UI change, and ship its
  transitions (`apps/web/DESIGN.md` › Motion; visual identity "Séance" in
  the same file).
- The installed APK can be several releases behind the web: reach a native
  plugin only once `Capacitor.isPluginAvailable()` says so, never on
  `isNativeApp()` alone. A new plugin goes in `apps/web` and `apps/mobile`
  at the same version.
- Every alert (bell, push, email) is declared once in `ALERTS`
  (`packages/shared/src/alerts.ts`). A new alert starts there.
- An email is a `build…()` function in `apps/api/src/mail/templates/<theme>.ts`
  drawn with `MailLayout`, an entry in `mail-gallery.ts` (Admin's preview),
  and a `send…()` on `MailService`, which keeps only transport and sending.
- A shipped user-facing feature gets a `"Nouveau"` badge entry in
  `apps/web/src/lib/feature-badges.ts` at its point of discovery.
