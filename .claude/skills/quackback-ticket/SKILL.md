---
name: quackback-ticket
description: Pick up a Quackback feedback/bug ticket, implement it, open a PR, and close the loop back on Quackback once merged. Use when Logan says "traite ce ticket quackback <id-or-link>" or similar.
---

# Quackback ticket workflow

Triggered manually by Logan with a ticket id (`post_...`) or a feedback.loomkeep.app link. Implement,
open the PR, and stop there (step 4) — closing the loop once the PR merges is handled by a separate
claude.ai routine (`Quackback — close ticket on PR merge`, webhook-triggered on GitHub `pull_request`
closed/merged events), not by this session waiting around. Don't `ScheduleWakeup` to poll for the merge.

## 1. Fetch the ticket

- `get_details({ id: <post_id> })` (via the Quackback MCP) to read title, description, board, and current status.
- If you were only given a link, extract the post id from it, or `search()` by title text to find it.

## 2. Move it to In Progress

- If the post isn't already in an "in progress" style status, find that status's TypeID (e.g.
  `search({ boardId, status: "in_progress" })` on the same board and read `statusId` off a result, or off the
  board's status list if `get_details` on the board exposes it) and call
  `triage_post({ postId, statusId })`.
- Don't touch tags or owner unless asked.

## 3. Implement

- Follow this repo's [CLAUDE.md](../../../CLAUDE.md): branch off `main`, respect the monorepo conventions
  (`pnpm build:package` after any `packages/shared` change, i18n via `paraglide`/`m()`, the "Nouveau" badge
  for user-visible features, etc.).
- Write the test(s) the change needs per the usual bug/feature discipline. Let `pre-commit`/`pre-push` hooks
  handle lint/format/typecheck — don't duplicate them manually mid-flight.
- Bump the version + changelog (`CHANGELOG.md` and, if user-facing, the Quackback changelog) only if this
  ticket is significant enough per the versioning rule in CLAUDE.md — most bug fixes aren't.

## 4. Open the PR

- Commit and push the branch. Never add "Co-Authored-By Claude" in then commit description.
- Then `gh pr create`. Reference the ticket in the PR description (link to
  `https://feedback.loomkeep.app/...` or just the post id) so the connection is traceable from GitHub too.
- Tell Logan the PR is up and give him the link. He merges it himself (or uses the desktop app's own
  Auto-fix/Auto-merge CI toggles) — do not merge it yourself. This session's job ends here.

## 5. Closing the loop (handled elsewhere)

- The `Quackback — close ticket on PR merge` routine picks up the merge event automatically: it adds
  the PR link as a comment on the ticket and moves it to "Completed" if the change genuinely resolves
  it. That's why step 4's PR description must reference the ticket (link or post id) — the routine
  reads it from there.
- If that routine doesn't exist yet or misfires, fall back to the manual version: once merged,
  `add_comment({ postId, content: "<PR URL>" })`, then look up the "Completed" status TypeID the same
  way as step 2 and `triage_post({ postId, statusId })`.
