# @loomkeep/api

NestJS REST API for Loomkeep — Prisma/PostgreSQL persistence, JWT auth, and
the live catalogue providers (TMDB, AniList, IGDB, Open Library,
MusicBrainz). For the project as a whole (what Loomkeep is, self-hosting,
Docker), see [docs.loomkeep.app](https://docs.loomkeep.app). For architecture
decisions and dev conventions shared with the web app, see the root
[CLAUDE.md](../../CLAUDE.md).

## Stack

- **NestJS** on **Fastify** (`@nestjs/platform-fastify`), global prefix
  `/api`, global JWT guard (`@Public()` to opt out).
- **Prisma** + **PostgreSQL**, schema in `prisma/schema.prisma`. An `erd`
  generator (`prisma-erd-generator`) is configured alongside the client
  generator — run `pnpm exec prisma generate` to also emit an ERD diagram.
- **Auth**: access JWT (15 min) + rotating refresh tokens (one row per
  device, SHA-256 hashed).
- **`nestjs-pino`**: structured JSON logs, pretty-printed only in
  `NODE_ENV=development`. `Authorization`/`Cookie`/`Set-Cookie` redacted,
  request bodies never logged.
- **Sentry SDK** (`@sentry/node`, `src/instrument.ts`) reports 5xx
  exceptions to GlitchTip when `GLITCHTIP_API_DSN` is set — see
  [Error tracking](https://docs.loomkeep.app/self-hosting/optional-services/error-tracking/).
- **Swagger UI** on `/docs`, dev-only (`NODE_ENV=development`) — the
  `@nestjs/swagger` import is dynamic so it's never bundled in production.

## Modules (`src/`)

Domain modules, one per bounded concern:

- `catalog/` — the `CatalogProvider` interface + TMDB/AniList/IGDB/Open
  Library/MusicBrainz providers, and `MediaItemService.upsertFromSource()`
  (the single entry point that persists a catalogue item on-demand).
- `library/` — a user's tracked items, watch/read/listen progress.
- `import/` — interactive import pipelines (TV Time, Trakt, Simkl,
  MyAnimeList, Steam, Goodreads, StoryGraph, Babelio) under `sources/`,
  behind a shared analyze → review → commit flow.
- `reviews/`, `comments/`, `social/`, `reports/` — the social feature set,
  gated behind `SOCIAL_ENABLED` (see
  [social/README.md](src/social/README.md) for the full design).
- `lists/` — user-curated, optionally shared collections.
- `notifications/`, `jobs/` — in-app notifications, Web Push, and the
  scheduled jobs (`@nestjs/schedule`) that scan tracked shows for new
  episodes. `JobRunService` records every run for the admin "Jobs" page and
  optionally pings Healthchecks.io per job — see
  [Scheduled jobs](https://docs.loomkeep.app/self-hosting/scheduled-jobs/).
- `stats/` — per-domain and admin aggregate statistics.
- `admin/` — moderation queue, ops summaries.
- `auth/`, `users/`, `security/` — auth flows, account management,
  login-failure tracking.
- `mail/` — SMTP sending (password reset, verification, alerts) via
  `nodemailer`; silently disabled when `SMTP_*` is unset.
- `health/` — `/health` endpoint used by Docker healthchecks and the
  Homepage dashboard widget.
- `common/`, `config/` — cross-cutting utilities and env/config loading.

## Commands

Setting up the whole repository is in the
[contributing guide](https://docs.loomkeep.app/project/contributing/). This package's own:

```sh
pnpm --filter @loomkeep/api test           # unit tests, offline (HTTP calls are stubbed)
pnpm --filter @loomkeep/api test:e2e       # full API flow against the dev Postgres, isolated "e2e" schema
pnpm --filter @loomkeep/api exec prisma migrate dev --name <name>   # after editing schema.prisma
pnpm --filter @loomkeep/api generate:openapi   # the public API's openapi-v1.json, after `build`
```

## Environment

`ConfigModule` reads `apps/api/.env` first, then the repo-root `.env` as a
fallback: the first file to define a key wins. `apps/api/.env.example` only
holds what must differ from the Docker deployment (`DATABASE_URL`,
`WEB_ORIGIN`, dev secrets); everything else lives once in the root
`.env.example`, documented for self-hosters in
[Configuration](https://docs.loomkeep.app/self-hosting/configuration/).
