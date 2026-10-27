---
name: version-bump
description: Bump the app version (package.json lockstep, CHANGELOG.md, Quackback changelog draft). Use when Logan says "bump la version", or after a feature domain/significant fix has just shipped and needs a version bump per CLAUDE.md's versioning rule.
---

# Version bump workflow

Triggered manually by Logan, usually right after merging the PR(s) for a feature domain or a
significant fix. Do the ritual described in [CLAUDE.md](../../../CLAUDE.md) → Conventions →
Versioning, mechanically, in one pass. `main` takes no direct pushes: work on a branch
(`chore/release-X.Y.Z`) cut from a freshly fetched `origin/main`, and open a PR.

**Merging that PR is the release.** Once CI passes on it, `release.yml` creates the GitHub release
`vX.Y.Z` from the CHANGELOG section, `ci.yml`'s docker-tag tags the images `X.Y.Z`, `X.Y`, `X`
and `latest`, and `mobile.yml` attaches the APK. Nothing to tag or publish by hand.

## 1. Gather what shipped, from two sources

- Read the current version from root `package.json`. The previous release is the tag
  `v<current>` when it exists; before the first one, find the bump commit:
  `git log -S'"version": "<current>"' --format='%h %ad %s' -- package.json`.
- **Source 1, the commits.** Read the **full** history since then, bodies included — never only
  `--oneline`: `git log <since>..origin/main --no-merges --format='=== %h %ad %s%n%b' --date=short`.
  Write it to the scratchpad if it is long. A squashed PR whose body is only a list of titles (or
  empty) says nothing about what changed: read its real diff (`git show --stat <hash>`, then the
  key files). `docs/` files added by a PR (audits, ADRs) often describe it. Skip Dependabot
  dependency lists and CI-only commits unless user-visible.
- **Source 2, `## [Unreleased]` in CHANGELOG.md.** Every PR with a noticeable change is meant to
  add its bullet there (CLAUDE.md → Conventions).

## 2. Reconcile the two, and report before writing

Build a table, one row per change, and show it to Logan before editing anything:

| Change | Commit(s) | In `[Unreleased]`? | Action |
| ------ | --------- | ------------------ | ------ |

- **Shipped but missing from `[Unreleased]`** (✨ / 🐛 / user-visible ⚡ commit with no bullet):
  draft the missing bullet from the diff.
- **In `[Unreleased]` but no matching commit since the last release** (reverted, never merged,
  already released, or describing something the code doesn't do): flag it; don't silently keep
  or drop it.
- **Bullet that disagrees with its commit** (names a different flag, default, route or
  behaviour than the diff shows): correct it from the diff, and say so.
- Self-hosting upgrade steps (new required env var, changed default, port, volume, migration to
  watch) get their own bullet, worded as what a self-hoster must do.

## 3. Decide the bump

Minor if a new module/significant capability shipped, patch for smaller fixes/polish — per
CLAUDE.md. If it's ambiguous, ask Logan rather than guessing (this determines X.Y.**Z** vs
X.**Y**.0).

## 4. Bump package.json in lockstep

Edit the `version` field in all six, to the same new value:

- `package.json` (root)
- `apps/api/package.json`
- `apps/web/package.json`
- `apps/docs/package.json`
- `apps/mobile/package.json`
- `packages/shared/package.json`

Then check none was missed — every line must show the new version:
`grep -H '"version"' package.json apps/*/package.json packages/*/package.json`.

Don't touch anything else in these files.

## 5. CHANGELOG.md

- Turn `## [Unreleased]` into `## X.Y.Z — <short title>` (reconciled per step 2), and put a fresh,
  empty `## [Unreleased]` above it. The heading must start with `## X.Y.Z ` exactly: `release.yml`
  finds the release notes by it and fails without it.
- Same technical, git-facing tone as existing entries: what changed and why, for a future
  engineer, not for end users.

## 6. Quackback changelog entry (user-facing)

- Fetch the permanent draft titled `Template — Loomkeep X.Y.Z` (`search()` or `list_conversations`-style
  lookup on the changelog, then `get_details`) to get the current structure/tone to reuse.
- `create_changelog` (or duplicate + `update_changelog`) with title `Loomkeep X.Y.Z`, body: a short,
  warm one-line summary of what this release is about (**not** the generic "Here's what's changing
  in this version." placeholder — write a real sentence specific to this release), then the
  `✨ New` / `🔧 Improvements` / `🐛 Fixes` sections (keep only the ones that apply), in plain user
  language — translate the CHANGELOG.md bullets, don't just copy them verbatim — and end with a
  short, warm closing line (thank-you / see-you-next-time tone, not another feature bullet).
- **Leave it in draft status.** Publishing sends the release newsletter to every subscriber — that
  is a real, irreversible, externally-visible action. Tell Logan the draft is ready and give him
  the link; he publishes it himself when ready. Never call whatever publish/status action makes it
  live without his explicit go-ahead in chat.
- If any Quackback posts (Feature Requests / Bug Reports) were resolved by this release, backfill
  `linked posts` on the changelog entry now (per CLAUDE.md's "Feedback board" note).
- Then move every one of those linked posts to the **Archived** status: for each post's board, find
  the "archived" status TypeID (`search({ boardId, status: "archived" })`, same lookup pattern as
  the quackback-ticket skill's "In Progress" step) and `triage_post({ postId, statusId })`. This is
  a Quackback status change, separate from the post's Quackback comment/PR-link handling done in
  the quackback-ticket skill.

## 7. Commit and open the PR

- `git add` the six `package.json` files + `CHANGELOG.md`, commit with `🔖 Bump version to X.Y.Z`.
- Push the branch and open the PR titled `🔖 Bump version to X.Y.Z`, the reconciliation table
  from step 2 in its body. Logan merges it; after CI, check the release `vX.Y.Z` exists with its
  APK and that `ghcr.io/logan2234/loomkeep-api:X.Y.Z` lists `linux/amd64` and `linux/arm64`.
