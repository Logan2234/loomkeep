---
name: quackback-ticket
description: Pick up a Quackback feedback/bug ticket, implement it, open a PR, and close the loop back on Quackback once merged. Use when Logan says "traite ce ticket quackback <id-or-link>" or similar.
---

# Quackback ticket workflow

Triggered manually by Logan with a ticket id (`post_...`) or a feedback.loomkeep.app link. Do the whole
cycle end to end in this one session — do not spawn scheduled tasks or background polling outside
`ScheduleWakeup` (see step 6).

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

- Push the branch and `gh pr create`. Reference the ticket in the PR description (link to
  `https://feedback.loomkeep.app/...` or just the post id) so the connection is traceable from GitHub too.
- Tell Logan the PR is up and give him the link. He merges it himself (or uses the desktop app's own
  Auto-fix/Auto-merge CI toggles) — do not merge it yourself.

## 5. Wait for the merge

- Use `ScheduleWakeup` to check back periodically (20-30 min is reasonable — this is external GitHub state
  the harness can't push-notify you about) with `gh pr view <number> --json state,mergedAt,url`.
- If the PR closes without merging, stop and ask Logan what to do — don't touch the Quackback status.

## 6. Close the loop on Quackback

- Once merged: `add_comment({ postId, content: "<PR URL>" })` on the ticket, then look up the "Completed"
  status TypeID the same way as step 2 and `triage_post({ postId, statusId })` to mark it done.
- Only do this if the change genuinely resolves the ticket — if it's a partial fix, say so instead of
  completing it and ask Logan.
- Stop the `ScheduleWakeup` loop once this is done.
