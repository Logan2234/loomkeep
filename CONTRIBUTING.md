# Contributing to Loomkeep

Thanks for taking the time to contribute! Loomkeep is maintained solo
([@Logan2234](https://github.com/Logan2234)) as a side project, so response
times can vary — but PRs and issues are genuinely welcome.

## Before you file something

- **Feature idea or a bug in the app itself** (UI, sync, watch tracking...)?
  That goes on [feedback.loomkeep.app](https://feedback.loomkeep.app), not
  GitHub Issues — the **Feature Requests** and **Bug Reports** boards there
  are public and votable.
- **Bug in self-hosting/deployment** (Docker, migrations, reverse proxy)?
  [Open a GitHub issue](https://github.com/Logan2234/loomkeep/issues/new/choose)
  with the _Self-hosting / deployment bug_ template.
- **Anything about the codebase itself** (a contribution question, CI, docs)?
  Same place, _Other_ template.
- **Security vulnerability?** Don't open a public issue — see
  [SECURITY.md](SECURITY.md).

## Project layout

pnpm workspace, 100% TypeScript:

| Path              | What                                                       |
| ----------------- | ---------------------------------------------------------- |
| `apps/api`        | NestJS + Prisma + PostgreSQL                               |
| `apps/web`        | SvelteKit PWA                                              |
| `packages/shared` | DTOs/enums shared by both, consumed from its built `dist/` |

[`CLAUDE.md`](CLAUDE.md) is the deep-dive architecture doc (data model,
auth, feature flags, i18n, conventions) — worth a skim before a non-trivial
change, whether you're a human or an AI coding agent.

## Local setup

```sh
pnpm i
docker run -d --name loomkeep-dev-db -e POSTGRES_USER=loomkeep \
  -e POSTGRES_PASSWORD=loomkeep -e POSTGRES_DB=loomkeep \
  -p 5433:5432 postgres:18-alpine
cp .env.example .env
cp apps/api/.env.example apps/api/.env
pnpm --filter @loomkeep/api exec prisma migrate dev
pnpm generate
pnpm dev        # api on :3000, web on :5173
```

Full self-hosting instructions (Docker, add-ons, SSO...) are in the
[README](README.md) — that setup is for _running_ Loomkeep, this one is for
_working on it_.

## Making a change

1. Branch off `main`, `feat/`, `fix/`, `chore/` prefixes are required.
2. Match the existing style rather than introducing a new one: read the
   surrounding code before writing yours, and check `apps/web/DESIGN.md` for
   anything UI-facing.
3. Keep changes surgical — a bug fix doesn't need a drive-by refactor of
   nearby code, and vice versa. If you spot something else worth fixing,
   mention it in the PR description rather than folding it in.
4. Every non-trivial feature needs at least one test; a bug fix needs a
   regression test that fails before the fix and passes after.
5. `pre-commit` (lint-staged) and `pre-push` (typecheck) hooks run
   automatically — don't skip them (`--no-verify`). CI runs the full test
   suite, e2e, and a few security/quality scans (CodeQL, Trivy, pa11y) on
   every PR.

### Commit messages

Imperative, English, one emoji prefix per the summary line:

| Emoji | Code         | For                         |
| ----- | ------------ | --------------------------- |
| ✨    | `:sparkles:` | A new feature               |
| 🐛    | `:bug:`      | A bug fix                   |
| ♻️    | `:recycle:`  | A refactor                  |
| 📝    | `:memo:`     | Docs, comments, tests       |
| ⚡    | `:zap:`      | Performance, build, tooling |
| 🔖    | `:bookmark:` | A version bump              |

## Opening a pull request

Target `main`. The PR template asks for the essentials — fill it in, it's
short on purpose. Draft PRs are fine if you want early feedback.

## License

AGPL-3.0. By contributing, you agree your changes are licensed under the
same terms as the rest of the project.
