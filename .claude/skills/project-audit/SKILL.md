---
name: project-audit
description: Full source-only technical audit of the Loomkeep codebase, delivered as a filterable HTML artifact (tech debt, bugs, security, performance, tests, observability, DX, docs). Use when Logan asks for "un audit complet", "un audit du projet", "un audit technique", or runs a recurring code review.
---

# Project audit

A deep technical review of `apps/api`, `apps/web` and `packages/shared`. The output is a single
self-contained HTML artifact Logan works through over the following weeks — so every finding
must be actionable on its own, with a reference ID he can quote back ("traite BUG-01, SEC-02").

**This is a reading exercise, not a tooling exercise.** The value is in what a careful reader
notices that ESLint, knip, CodeQL and Trivy already don't — they all run in CI, so anything
they'd catch is already caught. Don't rediscover their output.

**Each run stands alone.** Don't look up or diff against a previous audit: read the code as it
is today and report what you find. Reference IDs are stable _within_ a report, not across runs —
when a reference needs to travel, name the report's date with it.

## Method constraints

These are fixed. Do not widen the scope without asking.

- **Source only.** Read the actual code. No Quackback tickets, no git history, no `git status`
  — a finding must stand on what the code says today, not on what a commit message claims.
- **Never run lint / format / typecheck / the test suite** as a verification step. CLAUDE.md's
  rule applies here too: hooks and CI already cover it, and an audit changes no code.
  `pnpm audit --prod` is the one exception — it's the dependency-vulnerability input.
- **Never report front/back DTO desync.** Types, enums and DTOs are generated through OpenAPI
  from `packages/shared`; they are consistent by construction.
- **No new features here.** This audit is corrective: what's broken, risky, slow, duplicated,
  untested or wrongly documented. Product ideas and new capabilities belong to the sibling
  `feature-ideas` skill — if one occurs to you mid-read, note it for that skill and move on.
- **No code changes.** The audit produces a report. Fixes are a separate, later request.

## 1. Survey before reading

Get the shape of the repo before opening files, so reading time goes where the mass is:

```sh
find apps/api/src -name "*.ts" ! -name "*.spec.ts" -printf "%s %p\n" | sort -rn | head -45
find apps/web/src -type f \( -name "*.ts" -o -name "*.svelte" \) -printf "%s %p\n" | sort -rn | head -45
grep -c "@@index" apps/api/prisma/schema.prisma
```

Then the cheap negative checks, which mostly come back clean and tell you where _not_ to spend
time: `grep -rn "queryRaw\|executeRaw"`, `": any\|as any"`, `"TODO\|FIXME\|HACK"`,
`"console\."`, `"{@html"`, and empty `catch {` blocks.

## 2. Read for real

Whole-file reads, in roughly this order — this is where findings actually come from:

- **Write paths first.** `auth.service.ts`, the four `*-library.service.ts`, `media-item.service.ts`,
  `xp.service.ts`, `import-job.service.ts`, `comment.service.ts`. Look for check-then-act races,
  unhandled Prisma `P2002`, missing ownership assertions, and side effects that escape their
  transaction.
- **Cross-service duplication.** The four domain stacks (media / games / books / music) mirror
  each other by design; that's where copy-drift hides. A fix applied to three of four is the
  recurring failure mode here.
- **Guards and boundaries.** Every `*.guard.ts`, `main.ts` (CORS, helmet, body limits, trust proxy),
  `auth-cookies.ts`, `all-exceptions.filter.ts`, `env.validation.ts`, `docker/Caddyfile`.
- **The schema.** Read `@@index` against the actual query predicates in the services and crons —
  missing indexes on job paths are invisible until the table is big.
- **The web API layer.** `lib/api/core.ts`, `query.svelte.ts`, `mutation.svelte.ts`, then grep for
  components that bypass them (hand-rolled `loading`/`error` `$state`) — CLAUDE.md names
  `CommentThread.svelte` as the only sanctioned exception, so anything else is drift.
- **Coverage gaps by construction**, not by coverage report:
  `for f in $(find apps/api/src -name "*.service.ts" ! -name "*.spec.ts"); do [ -f "${f%.ts}.spec.ts" ] || echo "$f"; done`
- **Documentation drift.** Verify each factual claim in CLAUDE.md against the code. This section
  reliably yields findings and is cheap — a context file everyone trusts and nobody re-reads is
  exactly where stale facts survive.

## 3. Sections and reference IDs

| Section                           | Prefix   |
| --------------------------------- | -------- |
| Qualité du code / dette technique | `DET-nn` |
| Bugs potentiels                   | `BUG-nn` |
| Sécurité                          | `SEC-nn` |
| Performance & passage à l'échelle | `PRF-nn` |
| Tests & couverture                | `TST-nn` |
| Observabilité & exploitation      | `OBS-nn` |
| DX & CI                           | `DVX-nn` |
| Documentation                     | `DOC-nn` |

Add another section if the code warrants one — these are the ones that have earned their place
so far, not a closed list.

Every item carries a severity (`critique` / `élevée` / `moyenne` / `faible`, plus `point fort`
for verified strengths), an effort estimate (`petit` / `moyen` / `gros`), a short title, a
description that names the concrete failure mode, and the file path(s) with line numbers.

Two rules that make the report usable rather than impressive:

- **Include the strengths.** One `point fort` item per section that has them, listing what is
  already solid. It stops a later audit from "discovering" a deliberate design decision as a
  problem, and it tells Logan what not to regress.
- **Say what breaks, not what's imperfect.** "N callers compute the same delay and fire together,
  so MusicBrainz's hard 1 req/s is exceeded during a parallel import" beats "the throttle could be
  more robust". If you can't name the failure, it's not a finding.

## 4. Deliver as an artifact

Load the `artifact-design` skill first, then publish with the `Artifact` tool.

Required interactions (Logan works through the report over weeks, so it's a tool, not a document):

- Filter by section, by severity, and by effort — multi-select within a group, AND across groups.
- Free-text search across title, description and file path, accent-insensitive
  (`normalize("NFD").replace(/[\u0300-\u036f]/g, "")`).
- A checkbox per item marking it handled, with a visibly distinct state (dimmed + struck-through)
  and a global progress bar. In-memory for the session is enough — no persistence needed.
- Per-section counters that update with the active filters, and an empty state.

**Visual identity: reuse the project's own.** `apps/web/DESIGN.md` defines "Séance" — projector
amber accent, Bricolage Grotesque / Hanken Grotesk / Space Mono, the light and dark palettes,
and the mono-timecode device. Take the palette values from that file rather than inventing one;
the report should look like it belongs to Loomkeep. Severity colors must stay clearly distinct
from the amber accent (a red → rust → slate → grey ramp works; keep amber for the accent alone).

Both themes are required, tokens declared on bare `:root` first — see `artifact-design`.
Put the run's date in the page title so a reference stays traceable to its report.

## 5. Hand it over

Publish, then in chat give Logan the link plus the four or five findings you'd act on first,
each in one or two sentences with its reference ID. Do not paste the whole report into the
terminal — the artifact is the deliverable.

## Follow-up: dispatching the fixes

Logan usually comes back with a list of IDs to fix, and wants them spread across parallel agents.
When that happens, group **by file ownership before thematic coherence** — two agents editing
`library.service.ts` or `schema.prisma` at the same time will clobber each other. Concretely:

- One agent, and one only, owns `prisma/schema.prisma` and any migration.
- Findings that live in the same file go to the same agent, even if their themes differ.
- State the grouping and the model per agent, and flag any group with fewer than ~4 tasks — the
  spin-up cost isn't worth a single small fix.
- Raise product ambiguities with Logan **before** launching: subagents can't ask him anything.
