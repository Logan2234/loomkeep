# Social — architecture notes

Covers `apps/api/src/social/`, plus the adjacent `reviews/`, `comments/`, and
`reports/` modules that share its data model.

## Feature flag

Gated behind the runtime `SOCIAL_ENABLED` env var, read by the web via
`GET /api/config` (`RuntimeConfigModule`) — self-host defaults to off, the
public VPS build turns it on (see `docker/docker-compose.prod.yml`).
`SocialFeatureGuard` 404s every social route when off (never 403 — a
self-host install shouldn't even advertise the surface exists).

## Visibility model

Two layers: `User.profileAccess` (PUBLIC/PRIVATE/GHOST) acts as a cap over a
per-domain, per-facet `VisibilitySetting` audience (LIBRARY/ACTIVITY facets,
NONE/FRIENDS/PUBLIC). `Follow` is the single relationship primitive (a
directed edge; friend = reciprocal _accepted_ follow, no separate friendship
table); `Block` is a hard cut, checked via `VisibilityService.getRelation`
everywhere a viewer reads another user's data.

## Content registers

Content stays split into three registers, never conflated:

- private `notes` (plain text, never leaves the server)
- `Review` (mandatory /10 rating + optional text + explicit audience — the
  single source of truth for ratings; entry `rating` columns were removed
  and are now projected from `Review` via `ReviewService.getRatings`)
- `Comment` (threaded discussion, flat + one reply level, soft-deleted with
  a tombstone so replies stay attached — targets a work or, for TV/anime,
  one of its seasons/episodes via `CommentTargetType`, the same shape as
  `ReviewTargetType`)

`ActivityEvent` is a materialised, append-only feed log — two read surfaces,
the home feed (followed users' milestones only) and a user's full profile
timeline.

`Report` is a polymorphic moderation target (`ReportTargetType`:
COMMENT/REVIEW/USER/LIST) feeding the admin `/admin/reports` queue. Only
`POST /comments/:id/report` exists today, so COMMENT is the only kind a user
can actually file; `ReportService.resolveTarget` already handles USER and
LIST too (so the admin queue can render them), modelled ahead of a future
"report a profile/list" entry point with no schema change. REVIEW has
neither a create path nor a `resolveTarget` case yet.

## GHOST / Figurant mode

Fully behavioural, no extra storage: switching to GHOST immediately removes
incoming followers, cancels outgoing follows/requests toward non-public
profiles, and downgrades shared lists to Privé (behind a confirmation modal
showing live counts). Their comments/reviews render under a pseudonym
derived at render time (`pseudonym.util.ts`, zero storage) instead of their
real identity — moderation (`/admin/reports`) still sees the real identity.
A Figurant can't follow a non-public profile, share a list, or be
`@mentioned`.

**Known gap:** blocking a Figurant from within a comment isn't built —
they have no visitable profile to block from.
