---
name: version-bump
description: Bump the app version (package.json lockstep, CHANGELOG.md, Quackback changelog draft). Use when Logan says "bump la version", or after a feature domain/significant fix has just shipped and needs a version bump per AGENTS.md's versioning rule.
---

# Version bump workflow

Triggered manually by Logan, usually right after merging the PR(s) for a feature domain or a
significant fix. Do the ritual described in [AGENTS.md](../../../AGENTS.md) → Conventions →
Versioning, but mechanically, in one pass, on `main` (`git pull` first, work directly on `main` —
this isn't feature work, no branch needed unless Logan says otherwise).

## 1. Decide the bump

- `git log <last-tag-or-last-CHANGELOG-entry>..HEAD --oneline` (or just read recent merged PRs) to
  see what shipped since the last version.
- Minor if a new module/significant capability shipped, patch for smaller fixes/polish — per
  AGENTS.md. If it's ambiguous, ask Logan rather than guessing (this determines X.Y.**Z** vs
  X.**Y**.0).
- Read the current version from root `package.json`.

## 2. Bump package.json in lockstep

Edit the `version` field in all four, to the same new value:

- `package.json` (root)
- `apps/api/package.json`
- `apps/web/package.json`
- `packages/shared/package.json`

Don't touch anything else in these files.

## 3. CHANGELOG.md entry

- Add a new `## X.Y.Z — <short title>` section right under `## [Unreleased]`, in the same
  technical/git-facing tone as existing entries (see the file for examples) — bullet points on
  what changed and why, written for a future engineer reading git history, not for end users.
- If `[Unreleased]` already has bullets, fold them into the new section instead of duplicating.

## 4. Quackback changelog entry (user-facing)

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
  `linked posts` on the changelog entry now (per AGENTS.md's "Feedback board" note).
- Then move every one of those linked posts to the **Archived** status: for each post's board, find
  the "archived" status TypeID (`search({ boardId, status: "archived" })`, same lookup pattern as
  the quackback-ticket skill's "In Progress" step) and `triage_post({ postId, statusId })`. This is
  a Quackback status change, separate from the post's Quackback comment/PR-link handling done in
  the quackback-ticket skill.

## 5. Commit

- `git add` the four `package.json` files + `CHANGELOG.md`, commit with `:bookmark: Bump version to X.Y.Z`
  (no dedicated gitmoji for releases in AGENTS.md's list — `:bookmark:` is the conventional-commits
  choice for version bumps; ask Logan if he'd rather use something else).
- Push only if Logan confirms — committing to `main` directly is already a bit unusual, don't also
  push without asking.
