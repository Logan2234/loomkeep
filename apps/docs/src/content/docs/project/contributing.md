---
title: Contributing
description: Set up a development environment, and how changes are made and reviewed.
---

Pull requests and issues are welcome. Loomkeep is maintained by one person
on their spare time, so answers can take a few days.

## Before you start

- A **feature idea** or a **bug in the app**? It goes on
  [feedback.loomkeep.app](https://feedback.loomkeep.app), not GitHub: the
  boards there are public and votable.
- For a sizeable change, open an issue first to agree on the approach
  before writing the code.

## Development setup

You need Node.js 22 or later, [pnpm](https://pnpm.io) and Docker for the
database.

```sh
git clone https://github.com/Logan2234/loomkeep.git
cd loomkeep
pnpm install
docker run -d --name loomkeep-dev-db -e POSTGRES_USER=loomkeep \
  -e POSTGRES_PASSWORD=loomkeep -e POSTGRES_DB=loomkeep \
  -p 5433:5432 postgres:18-alpine
cp .env.example .env               # add your TMDB token
cp apps/api/.env.example apps/api/.env
pnpm --filter @loomkeep/api exec prisma migrate dev
pnpm generate
pnpm dev                           # API on :3000, web on :5173
```

`pnpm dev:docs` serves this documentation on :4321 once the API is built.

## The repository

| Path              | What it holds                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `apps/api`        | The API: NestJS, Prisma, PostgreSQL.                                                           |
| `apps/web`        | The web app: SvelteKit, installable as a PWA.                                                  |
| `apps/docs`       | This documentation: Astro Starlight, and Scalar for the API reference.                         |
| `packages/shared` | Types and enums shared by the API and the web app. Run `pnpm build:package` after changing it. |
| `docker/`         | The compose files, the Caddy configuration and the optional services.                          |

[`CLAUDE.md`](https://github.com/Logan2234/loomkeep/blob/main/CLAUDE.md) at
the root is the detailed architecture guide: data model, authentication,
feature flags, internationalisation and conventions. Skim it before a
non-trivial change. [Architecture](/project/architecture/) gives the
overview.

## Making a change

1. **Branch** off `main`, with a `feat/`, `fix/` or `chore/` prefix.
2. **Match the surrounding code** rather than bringing a new style. For
   anything visual, the design system is in `apps/web/DESIGN.md`.
3. **Keep it focused**: a fix doesn't need a refactor next to it. Mention
   anything else you noticed in the pull request instead.
4. **Test it**: a feature comes with at least one test; a bug fix with a
   test that fails before the fix and passes after.
5. **Let the hooks run**: `pre-commit` lints and formats what you commit,
   `pre-push` type-checks. Continuous integration then runs every test, the
   end-to-end suite and security scans.
6. **Write text through the translation catalogs**: the interface is
   English-first, and no visible string is written straight into a component.

Commit messages are short, imperative, in English, and start with an emoji:

| Emoji | For                         |
| ----- | --------------------------- |
| ✨    | A new feature               |
| 🐛    | A bug fix                   |
| ♻️    | A refactor                  |
| 📝    | Docs, comments, tests       |
| ⚡    | Performance, build, tooling |

## Pull requests

Target `main` and fill in the template; it is short on purpose. Draft pull
requests are welcome for early feedback.

Before your first pull request is merged, you sign the
[Contributor License Agreement](https://github.com/Logan2234/loomkeep/blob/main/CLA.md)
with one click, when CLA Assistant asks in a comment. You keep the copyright
on your code; the agreement lets the project also ship it under other
licenses, which the [premium edition](/project/license/) needs.
