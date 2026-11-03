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
typechecks what changed, and CI runs the full suite + e2e on every PR. Run a
test only for new/changed logic or a bug fix, not for a style tweak, a
wording change or a rename.

## Architecture

### Data model & catalog

- **On-demand cache, not a mirror.** Catalogs (TMDB + AniList, IGDB, Open
  Library, MusicBrainz — one provider per domain) are queried live. A
  `MediaItem`/`GameItem`/`BookItem`/`MusicItem` is created only when a user
  first tracks it, through its domain's `upsertFromSource()`. Refreshes
  (24h TTL) never delete seasons/episodes, so `EpisodeWatch` rows keep a
  valid target. Behaviour the four domains must share gets a case in
  `apps/api/src/common/domain-parity.spec.ts`.
- TMDB movie/TV ids are separate namespaces: every call carries a
  `MediaType`. TVDB ids are captured from TMDB because the TV Time import
  reconciles through them.
- `LibraryEntry.watchedEpisodes`/`lastWatchedAt` and `MediaItem.episodeCount`
  are maintained by Postgres triggers — never write them from the app.
- Import sources share a base class per domain (`MediaImportSource`,
  `BookCsvSource`): a new source only supplies its parsing.
- Shared enums (`packages/shared/src/enums.ts`) mirror Prisma enums with
  identical values — cast at boundaries, don't write a mapping function.

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
  rollouts and kill switches, with a fallback so an unconfigured flag never
  locks a feature out. Permanent instance configuration lives in the
  `InstanceSettings` table (Admin › Settings, `instanceSetting()`); an env
  var of the same name wins and locks it.
- Premium is a seam, not sold yet: call
  `EntitlementService.isEffectivelyPremium()`, never `hasPremium()`.
- A whole premium feature lives in `ee/` (`apps/api/src/ee`,
  `apps/web/src/lib/ee`) under [LICENSE-EE](LICENSE-EE). The core never
  imports `ee/` (ESLint enforces it), every `ee/` controller carries
  `EeLicenseGuard`, web screens use `useEeLock()`.

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
  (`parsePageQuery`), `PagedResult<T>` response.

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
- A shipped user-facing feature gets a `"Nouveau"` badge entry in
  `apps/web/src/lib/feature-badges.ts` at its point of discovery.
