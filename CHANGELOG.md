# Changelog

All notable changes to this project are documented here, grouped by the
roadmap phase they belong to (see `README.md` → Roadmap). No tagged releases
exist yet — the `version` field in `package.json` (root + every
`apps/*`/`packages/*`, kept in lockstep) is the current record of where the
app stands; see `CLAUDE.md` → Conventions for the versioning rule.

This file starts from the current state and is updated going forward on each
version bump — it does not attempt to reconstruct exhaustive history prior to
this point beyond the roadmap phases already documented in the README.

## [Unreleased]

## 1.0.0 — Stats overhaul: /stats, /profile, /admin/stats & ops pages

The roadmap has now shipped P1 through P4 with the app stable enough to call
finished — this is the first release reserved for that milestone (see
`CLAUDE.md` → Conventions), not a specific commit.

- New personal **`/stats` dashboard** ("La Régie"): a sticky domain/period
  filter console drives a cross-domain overview (totals, completion/abandon
  rates, rating distribution and decade-of-release histograms — both
  clickable through to the underlying works) plus a dedicated deep section
  per domain — Vidéo (total time, movie/series/anime split, longest binge,
  ghost/paused series), Jeux (playtime, never-launched, replays, rating by
  platform/genre), Livres (pages read, top authors by pages, rereads),
  Musique (listen duration — a new `MusicItem.durationMin` field captured
  from MusicBrainz — release-type split, top artists). A "Vidéo — activité
  dans le temps" section adds a GitHub-style calendar heatmap, day-of-week
  and hour-of-day curves, and monthly/yearly totals, since `EpisodeWatch` is
  the only true per-event log in the app today. A **Social** section (gated
  `SOCIAL_ENABLED`) covers reviews/comments/lists written, your rating vs the
  community's on works you both rated, new followers and social activity per
  month, and a contribution streak.
- **`/profile` "Intégré"**: per-domain totals and favorites, a streak badge
  (🎬N, shown wherever a pseudo appears — profile header, reviews, comments —
  never for a Figurant), first/last activity, a stats strip (time watched /
  most active year), top genres, inline social counters, and a mini
  consumption-heatmap teaser linking to the full `/stats` page.
- **`/admin/stats` rebuilt** as "Salle des machines": a KPI strip (accounts,
  active 24h/30j, cached works, DB size, pending reports) atop four dense
  sections — Comptes & engagement (new-account trend, retention cohorts,
  domains-enabled split, profile-privacy split, account health), Catalogue &
  cache (per-domain cache table with growth sparklines, most-popular works
  across the whole instance, cache mutualization/orphans), Social (totals,
  a reviews+comments activity trend, instance-wide rating distribution, top
  contributors, the reports queue's pending/resolved/median-delay/founded
  rate), and Système (DB size per table, API calls per provider, notification
  read rate, push subscriptions, login failures, last backup). The former
  `AdminStatsService`/`AdminStatsDto` — a single endpoint mixing four
  unrelated aggregate blocks for two unrelated pages — is gone, replaced by
  this dedicated page plus a small `AdminOverviewService` serving just the
  handful of counters the `/admin` dashboard and `/admin/communications`
  actually need.
- Every remaining operational admin page (Jobs, Import, Services, Cache,
  Signalements, Sécurité, Communications, Sauvegarde) gained a small
  summary-metrics header: failure rate/avg duration per job, import
  success rate and items-by-source, quota-bound vs unlimited service
  providers, top reporters and founded-rate on the reports queue, login
  failures by 24h/7j/30j, active push subscriptions by browser family, and
  backup regularity (median interval between dumps). Cache's own page
  already exposed staleness/orphans and was left untouched.
- Reviews and comments now show a streak badge next to any non-anonymized
  author's pseudo, computed with a single batched query per request rather
  than one per author.

## 0.8.0 — Reviews: votes & season/episode critiques, admin polish

- Reviews can now be upvoted/downvoted by other users (Reddit-style: one
  active vote per person, re-voting the same direction removes it). The net
  score shows on every review, including your own; voting is a social
  interaction (requires `SOCIAL_ENABLED`) and you can't vote on your own
  review.
- A season or episode can now get its own critique (rating + text + audience,
  votes included) directly from its row in the episodes list — the same
  "Mes reviews" component already used on the 4 work-detail pages, opened in
  a discreet icon-triggered modal (same pattern already used for its comment
  thread).
- Automatic daily backups (admin "Sauvegarde"): dumps are now persisted to
  disk (a dedicated Docker volume in self-host) instead of a one-off ad-hoc
  download, kept as the 7 most recent, listed/downloadable/deletable from the
  admin page, with a scheduled 3h job (also triggerable on demand from
  `/admin/jobs`).
- Admin dashboard redesign ("Poste de contrôle"): a status strip of the 4
  numbers an admin actually checks at a glance (accounts, services, jobs,
  backups), each linking to its page, plus every admin destination grouped by
  concern instead of one flat grid.
- `/admin/emails` and `/admin/push` merged into a single `/admin/communications`
  page (two tabs — preview/test-send a template, test/broadcast a push —
  instead of two separate nav entries for the same admin gesture).
- Home page redesign: a responsive card-grid dashboard (one card per enabled
  domain, always shown — even empty, with its own "voir plus" shortcut — so
  the layout never silently drops a section), a "Bientôt" teaser card for
  Podcasts/Jeux de société once opted into, and the activity feed teaser
  folded into the grid instead of sitting above/below it.
- Fixed: a Figurant's derived pseudonym avatar was seeded on their real,
  constant user id — the same identicon resurfaced on every thread they
  posted in even though the displayed pseudonym differed, defeating the
  point of not being able to correlate their activity across threads. Now
  seeded on the pseudonym itself (caught by a `frontend-design` pass).
- Dev/self-host: `WEB_ORIGIN` now accepts a comma-separated list (e.g. to
  allow both `localhost` and an ngrok tunnel domain at once); the web dev
  server proxies `/api` to the local API same-origin (mirroring what Caddy
  does for the Docker build) so testing through an ngrok tunnel no longer
  requires a cross-origin call to `localhost:3000` at all.

## 0.7.0 — P4: lists & Figurant mode

- Figurant/ghost mode (P4, increment 6 — closes P4): switching a profile to
  `GHOST` now applies immediately — incoming followers removed, outgoing
  follows/requests toward non-public profiles cancelled, shared lists
  downgraded to Privé, all behind a confirmation modal showing live counts of
  what will change. A Figurant's comments and reviews are shown to others
  under a derived pseudonym ("Figurant n°…", computed at render, nothing
  stored) instead of being hidden — a Figurant can no longer follow a
  non-public profile, share a list, or be `@mentioned`. Moderation
  (`/admin/reports`) still sees the real identity.
- Lists (P4, increment 5): cross-domain `List`/`ListItem` (a work can be a
  movie, game, book or album, mixed freely in one list), two kinds — `RANKED`
  (drag-to-reorder "top 10", numbered) and `COLLECTION` (unordered grid).
  Own explicit visibility (Privé/Amis/Public, defaults to Privé) — like
  reviews, never inherited from the per-domain visibility facets; managing
  your own lists works with social off, only reading someone else's shared
  list is social-gated. An "Ajouter à une liste" button on every work page
  opens a checklist of your lists; a "Listes" carousel appears on profiles
  (own and others', visibility-filtered) linking out to `/lists` to manage
  your own. New activity events for list creation, items added (aggregated)
  and sharing a previously-private list. Drag-and-drop reordering uses a new
  dependency, `svelte-dnd-action`, also adopted for reordering the mobile
  bottom-bar shortcuts in Réglages (previously up/down buttons).
- Fixed: a movie/series' comment thread stayed permanently spoiler-blurred
  even after finishing it — `LibraryEntry.finishedAt` was never set
  automatically (only an explicit field nothing in the UI ever sent). It now
  tracks completion automatically (movies follow the status flip to
  "vu", series/anime follow watch progress reaching the end).
  - Activity feed: episode watches now emit an aggregated `PROGRESS` event,
    and logging a game/book replay emits `REWATCHED` (both were modelled but
    never wired to an emitter).
- Comments no longer dominate a work's detail page: the thread is now
  collapsed behind a toggle button showing the comment count, matching how
  discreet the reviews section is. New comments are rate-limited to one per
  5 seconds per user.

## 0.6.0 — P4: activity feed & comments

- CI pipeline (GitHub Actions): lint/build/test/e2e/Docker build gates,
  Dependabot, CodeQL, Codecov.
- Social follow-ups (P4): private profiles now return a locked identity-only
  preview (with a request/cancel affordance) instead of a 404 — GHOST/blocked
  still 404, and no content leaves the server. A "Mon profil" nav entry opens
  your own profile as others see it. "Mes reviews" rows link to the work and
  support bulk delete / audience changes; the revision history shows each
  version's text. `/notifications` gained a followers/following network view.
- Social notifications: a generic `Notification` model powers in-app alerts for
  new followers, follow requests and approvals (alongside new-episode alerts).
- Reviews on detail pages: rate + write a critique (with audience) and read the
  community's reviews directly on each media/game/book/album page. The default
  review audience is now configurable from "Mes reviews".
- Profile bio is now editable from account settings (it was displayed but had
  no input).
- Activity feed (P4, increment 3): a materialised `ActivityEvent` log records
  library milestones (started/finished/dropped/added/favourited) and reviews
  across all four domains. A home feed at `/feed` (people you follow, binge-
  aggregated), a "Dernières activités" teaser on the home page, and a "Activité
  récente" timeline on each profile (visibility-filtered by the Activité facet).
- Comments (P4, increment 4): threaded discussion (flat + one reply level) on
  any work and, for series/anime, their individual seasons/episodes. Automatic
  spoiler masking compares the viewer's own progress (per-episode for
  season/episode targets, a binary "finished" gate for movies/games/books —
  albums are never masked, nothing to spoil), stacked with a manual tag; the
  reader can reveal a single blurred comment or turn off masking for the whole
  thread. Fixed 6-emote reactions (one per user/comment), @mentions and reply
  notifications reuse the existing `Notification` model and respect blocks.
  Reports are a polymorphic `Report` model (comments today, reviews/profiles
  ready for later) feeding a new `/admin/reports` moderation queue with a
  pending-count badge. The web app's first shared data-fetching layer,
  `@tanstack/svelte-query`, drives the thread (5s poll on the open thread only,
  paused when the tab is backgrounded).

## 0.5.0 — P4: social foundation & reviews

All of it is gated behind the runtime `SOCIAL_ENABLED` flag (off by default; a
single Docker image serves both modes), exposed to the web via `GET /api/config`.

- **Foundation**: `User.bio`/`profileAccess` (PUBLIC/PRIVATE/GHOST) and a
  `VisibilitySetting` matrix (per-domain × facet audience).
- **Social graph & profiles**: `Follow` (with private-profile approval) + `Block`,
  a central `VisibilityService`, public profiles at `/u/:username`, member search,
  and the account "Confidentialité" screen. Reusable identicon `Avatar`.
- **Reviews**: a `Review` model (mandatory /10 rating + optional text + audience)
  with edit history is now the single source of truth for ratings — the `rating`
  column was removed from every entry and projected from `Review` instead
  (rating your own items still works with social off). A "Mes reviews" management
  screen (`/reviews`) lists, edits and deletes them.
- Deferred within P4: social notifications (needs a generic `Notification` model),
  bio-editing UI, and the activity feed / comments / lists / Figurant increments.

## 0.4.0 — P3: games, books & music

- Games module (IGDB catalogue): library, statuses, playtime, Steam import,
  community ratings.
- Books module (Google Books catalogue): library, reading progress,
  StoryGraph/Goodreads import.
- Music module (MusicBrainz catalogue): library, listen status.
- Unified global search across all domains; `enabledDomains` enforced
  server-side on search/stats, and filters notifications.
- Unified async import framework — all sources (TV Time, StoryGraph,
  Goodreads, Steam) on one job engine with manual match-correction.

## 0.1.0 — P1 MVP, P1.5 TV Time import, P2 notifications

- P1: auth, search, tracking, episode progress, PWA, Docker self-host.
- P1.5: interactive TV Time import (analyze → review collection by
  collection → commit), matched through TVDB IDs, source-agnostic pipeline.
- P2: in-app notifications, periodic scan of tracked shows, Web Push,
  transactional/notification email via SMTP, PWA mobile access via ngrok.
  Native (Capacitor) wrapper still outstanding.
