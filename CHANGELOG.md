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

## 1.8.0 — Gamification, complete localization, and security hardening

- **Gamification is now a broad product surface.** An append-only
  XP ledger and materialized score power the shared level curve and the full
  cross-domain reward schedule, with live awards at every supported action
  and a nightly reconciliation job as an integrity backstop. Progress appears
  on profiles with the same privacy controls as activity, and the entire
  module remains gated by `GAMIFICATION_ENABLED` for self-hosters.
- **Achievements span evaluation, presentation, and reward feedback.** The
  code-defined catalogue contains 66 tier entries collapsed into roughly 42
  cards, masks locked secrets server-side, and has its own responsive
  `/app/achievements` screen. Unlocks and level-ups now run through an ordered
  animation queue; users can also explicitly equip up to three non-secret
  achievement tiers on their profile without automatic or privacy-sensitive
  defaults.
- **A new XP leaderboard** ranks the current month or year globally or among
  friends, with shared ranks for ties, a top-100 cut plus the viewer's own row,
  and privacy-aware avatar handling. It is gated by both the social and
  gamification feature switches.
- **French/English coverage is complete across the frontend and transactional
  email.** Translation catalogues were consolidated and audited, PWA startup
  now honors the selected locale, and generated manifest screenshots show
  real product views. The domain search control was also redesigned as
  keyboard-accessible tabs, with studio/franchise search for games and ISBN
  search for books.
- **The generated API contract now covers substantially more of the app.**
  Response DTOs and typed web requests were expanded across auth, config,
  notifications, reviews, social, lists, comments, admin, catalog, and the
  library domains, including typed query strings and convention tests that
  keep the OpenAPI boundary honest.
- **Security-sensitive flows were hardened after an internal audit.** Push
  endpoints are restricted to known providers to close an SSRF path;
  password checks now protect sensitive account and admin actions; login and
  MFA verification avoid timing and recovery-code abuse; sensitive endpoints
  have dedicated throttles; malformed ZIP offsets and oversized imports are
  rejected; backup restores call the runtime Prisma binary correctly; and
  both SvelteKit and Caddy emit additional isolation/security headers.
- **CI and dependency gates were modernized.** Lighthouse, Pa11y, and ZAP run
  against disposable stacks and publish useful results, Codecov combines the
  API unit/E2E and web suites by flag, Vitest moved to v5, vulnerable
  transitive dependencies were constrained, Corepack was pinned, and
  workflow permissions were narrowed.
- Fixed the library-list navigation loop, concurrent list reordering, broken
  cross-origin avatar delivery, reward-context rendering, and health-check
  regressions; reusable component extraction and smaller presentation helpers
  reduced duplication without changing unrelated behavior.

## 1.7.0 — MFA, premium entitlements, and translatable API errors

- **MFA for all users (LK-C17)**: TOTP and email one-time codes, independently
  toggleable in Settings, backed by bcrypt-hashed recovery codes shown once
  on activation. Login gains an intermediate challenge step (method picker
  when both are active). Admin routes 403 with `MFA_REQUIRED` when the
  account has no active method, checked live with no grace period — skipped
  outside `NODE_ENV=production` to avoid dev/staging friction.
- **Premium becomes a real seam, not just a flag.** New `UserEntitlement`/
  `Subscription` tables back `EntitlementService` (self-healing FREE default
  on every read), replacing the never-read `User.entitlements` Json field —
  see [docs/adr/0001-open-core-agpl.md](docs/adr/0001-open-core-agpl.md) for
  the managed-service positioning this unblocks. Gated behind it: iCal export
  and early-access domains (MUSIC/PODCASTS/BOARDGAMES), advanced stats
  (redacted server-side, with a blurred fake-data preview via a new
  `PremiumTeaser` component instead of just visually hiding real numbers),
  daily notification digests (weekly stays free), and a premium nav/dock
  styling option. An admin plan selector (`PATCH /admin/users/:userId/plan`)
  is the only way to grant premium today — no billing wired up yet.
- **API errors are now translatable codes, not raw English strings** — closes
  out a 4-phase migration across every domain (auth/MFA, library/import,
  catalog/providers, then the remaining tail) plus per-field validation
  errors (`class-validator` messages translated and shown under the
  relevant input instead of dumped in one banner). `AppException` +
  `ErrorCode` (`packages/shared/src/error-codes.ts`) replace bare NestJS
  exceptions API-wide; a `no-restricted-syntax` ESLint rule now errors on a
  regression. 5xx bodies never leak internals — the detail stays in logs,
  keyed by `requestId`.
- **Centralized API layer**: `createApiQuery`/`createApiMutation`/
  `createApiInfiniteQuery` (thin TanStack Query wrappers) replace hand-rolled
  `try/catch` + local `error`/`loading` state across nearly the entire web
  app, fixing several real unhandled-rejection bugs uncovered along the way
  (ProfileView's follow/block actions, review casting, stats drill-downs).
  Every paginated list endpoint now shares one `page`/`limit` +
  `PagedResult<T>` contract. Full design in
  [docs/plans/centralized-api-layer.md](docs/plans/centralized-api-layer.md).
- **Notification digests** replace instant push/email on new episodes with a
  per-channel cadence (weekly free, daily premium) timed at each user's
  local hour.
- **Catalog detail pages enriched and made locale-aware** across all four
  domains: TMDB (native rating, tagline, director/creator, trailer, content
  rating — plus a new `MediaItemTranslation` per-locale cache so a page
  browsed in French no longer shows a stale cached English title), AniList
  (Japanese voice actor pairing with a split cast photo and its own cast
  modal, director, trailer, studios, related titles, tags), Open Library
  (ISBN, series, language-matched edition, first sentence, external links),
  and IGDB (franchise, age ratings, trailer, multiplayer modes).
- **Compliance pass**: traceable CGU acceptance with a re-acceptance prompt
  on version changes (LK-C03), an illicit-content notice procedure (LK-C10),
  an inactive-account retention policy — reminder at 24 months, deletion at
  36 (LK-C06), reporter notifications on report outcome (LK-C07), an
  exhaustive GDPR data export (LK-C11), anonymised security/import audit
  identifiers on account deletion (LK-C04), and several documentation
  corrections (retention durations, age certification, a11y).
- **Backups are now encrypted at rest and shipped offsite**: every dump is
  age-encrypted before touching disk (only the public key lives on the
  instance), plus a VPS-cron script shipping encrypted dumps of every
  datastore to Cloudflare R2.
- Admin dashboards (Grafana/Portainer/GlitchTip/Unleash/Homepage) now sit
  behind a Cloudflare Tunnel + Access (GitHub SSO + MFA) instead of a
  directly-reachable origin fronted by Authelia (kept for self-hosters
  without Cloudflare).
- Proactive rate limiting for IGDB and AniList providers, instead of only
  reacting to a 429 after the fact.
- Motion/transition polish across the app (page transitions, modals,
  loading states) and free-account import quota management.

## 1.6.0 — Trakt & Simkl import, Open Library, and the new landing page

- **Trakt and Simkl join TV Time as import sources.** Trakt started out as an
  API-based import, but Trakt now gates creating an API application behind
  VIP (confirmed live, contradicting the docs) — a dead end for a self-hosted
  app, so it was replaced with a file-based import off Trakt's own account
  data export, reverse-engineered against a real populated export (no docs
  exist for that ZIP shape). Simkl has no such export in its free tier, so it
  goes through a real OAuth authorization-code flow instead — the
  `simkl.com/oauth/authorize` link is now built and followed client-side
  after a same-origin `/api/simkl/connect` redirect turned out to be silently
  swallowed by the browser (SvelteKit's link handling or the PWA service
  worker are the prime suspects). Shared analyze/resolve/commit mechanics
  were extracted into `MediaImportSource` (TvTimeImportSource now only
  supplies CSV parsing), and `GET /import/availability` greys out
  Steam/Trakt/Simkl with an "Indisponible" badge when their required env key
  isn't set, instead of leading into a wizard that can only fail.
- **Movie rewatches, favorites and ratings now import too.** A new
  `MovieReplay` model (mirrors `GameReplay`/`BookReplay`) lets a movie be
  rewatched more than once; `ImportMovie` gains a required `watchedAt: Date |
null` so every parser makes a real decision instead of silently omitting
  it, and `lists-favorites.json`/`ratings-*.json` feed `LibraryEntry.favorite`
  and `Review` from Trakt's export.
- **Reworked Séance landing page shipped to production**, replacing the
  marketing homepage assembled from several `/home-test` prototypes: full
  paraglide i18n (fr/en), auth-aware CTAs, SEO/OG head and Umami event
  tracking matching the page it replaces. Also adds a themed `+error.svelte`
  so unmatched routes stop falling back to SvelteKit's bare default page.
- **Library and search cards uniformized across all four domains** (movies/
  shows, books, games, music): a hover-to-favorite star replaces the
  always-static one, movies get a watched-status label and books a
  reading-progress bar (both previously tracked but never surfaced), and
  search result cards share one top-right +/check affordance. Filters, sort
  and search state now persist across back navigation — first attempted via
  `replaceState` from `$app/navigation`, which patches the raw history entry
  but not SvelteKit's own router state, so `page.url` stayed stale; fixed by
  switching to `goto(url, { replaceState: true, noScroll, keepFocus })`.
- **Provider attribution (LK-P01)**: a new `provider-brands.ts` +
  `ProviderMark.svelte` render official logo marks for TMDB, Open Library,
  OMDb, AniList, IGDB and MusicBrainz, plus a new Settings → "Sources de
  données" section centralizing their full legal notices — TMDB and Open
  Library require a logo/notice wherever their data shows, OMDb's CC BY-NC
  4.0 license requires attribution next to the scores it feeds.
- Added an Unleash feature-flag service (backend + frontend) for gradually
  rolling out future features.
- Adds trackable CTAs to previously link-less transactional emails
  (password-changed, new-device-login, email-changed, welcome) via
  configurable Umami Link short-URLs, and replaces per-send newsletter
  unsubscribe tokens with a stable per-user one plus a public `/unsubscribe`
  page reachable without logging in. Also adds Umami analytics to the app
  itself.
- Docker images now pull pre-built GHCR images instead of building on the
  VPS, and were shrunk further on top of that.
- DSA art. 17: comment takedowns and admin account deletions now persist a
  `ModerationDecision` record and notify the sanctioned user by email (+
  in-app when the account still exists); CGU §9 now only lists the two
  sanctions actually implemented.
- Smaller items: a logout button on the desktop nav rail and mobile menu, a
  hover bookmark shortcut on library poster cards, a beta badge next to the
  app version, the Ko-fi donation modal switched from an iframe embed to a
  plain outbound link (the iframe let Ko-fi deposit cookies before consent),
  and several privacy-policy disclosure updates (Cloudflare/CDN/push/
  donation flows, email tracking, a newsletter-consent timestamp).

- **Books now come from [Open Library](https://openlibrary.org/)** instead of
  the Google Books API. The new `OpenLibraryProvider` uses `/search.json`
  (Solr) for both search and a work's aggregate metadata — page count,
  publishers, subjects, rating — and `/works/{id}.json` for the description
  Solr doesn't carry. Merged works are served as redirect stubs, so details
  follow them and key off the canonical work id rather than the alias that was
  requested. Same-author suggestions now resolve through `author_key` instead
  of matching a display name, and crowd-sourced subjects are filtered down to
  genre-shaped ones (machine tags, sentence-long entries and case variants are
  dropped).
- **No API key, no quota, no branding requirement.** `GOOGLE_BOOKS_API_KEY` is
  gone — one less mandatory key for self-hosters — along with the free tier's
  1,000 requests/day ceiling and the "Powered by Google" marks the Google
  Books API terms required next to every result; plain courtesy attribution
  takes their place. `MUSICBRAINZ_CONTACT` becomes `API_CONTACT`, shared by
  both keyless providers (Open Library and MusicBrainz) for the identifying
  `User-Agent` their usage policies ask for.
- `BookSource.GOOGLE_BOOKS` → `OPEN_LIBRARY`, addressed by work id
  ("OL893414W") rather than a Google volume id. Since `BookItem` is an
  on-demand cache, the migration drops every cached book instead of converting
  it, together with everything referencing one through a polymorphic (FK-less)
  target — book reviews, comments, list items, activity events and the
  moderation rows resolved through them. **Breaking for self-hosters**: book
  library entries do not survive the upgrade (they hang off the cache through
  `BookEntry.bookItemId`); the other domains are untouched.
- **Books lose their adult signal**: Open Library exposes no equivalent of
  Google's `MATURE` maturity rating, so `BookItem.isAdult` is always false for
  now. The column and its per-account gate stay in place for the day a source
  provides one.
- Fixes the seed writing its book call counter under `google_books` while
  `QuotaTrackerService` wrote `googleBooks`, which left the row unlabelled on
  /admin/stats.

## 1.5.0 — Onboarding wizard, collaborative lists & account security

- **Mandatory first-run onboarding wizard**: guides new (and existing,
  pre-feature) users through picking their content domains, appearance and
  notification settings, and a domain-conditional import CTA, gated behind a
  new `User.onboardedAt` field. Introduces a reusable Wizard/Stepper shell
  and a `dismissable` escape hatch on Modal/Drawer for the one-shot,
  non-closable flow. Accounts now start with `enabledDomains=[]` (previously
  all domains enabled by default), set by the wizard itself.
- **Collaborative lists**: adds `ListMember`, a directed grant mirroring
  Follow/Block — the owner can add editors by username, who can add/remove/
  reorder items and edit title/description, but never delete the list,
  change its visibility, or manage members. Reorder takes an optimistic lock
  on `List.updatedAt` so concurrent editors get a 409 instead of clobbering
  each other's order. Ownership transfers to the earliest-added editor if
  the owner deletes their account, editors can leave a list themselves, and
  the invited user gets a notification.
- **Annual reading goal**: users can set a yearly target ("30 books in
  2026") and track progress via a gauge chip beside the `/books` title and a
  card on the home dashboard, computed on read from books finished that
  year (rereads included). `BookEntry.finishedAt` is now synced when a book
  is marked READ, which it previously wasn't — the goal would otherwise
  have silently undercounted.
- **New-device login alerts**: a durable per-user `UserDevice` table
  (independent of `RefreshToken`, which gets pruned) keyed on a normalized
  browser+OS label emails the account and logs a `NEW_DEVICE_LOGIN`
  `SecurityEvent` the first time a device is seen.
- **Breached-password check**: new passwords are checked against Have I
  Been Pwned's range API (k-anonymity, only a 5-char SHA-1 prefix ever
  leaves the server) on register, password reset and password change; fails
  open on any network error so an HIBP outage or offline self-host never
  blocks auth.
- **Account deletion made non-destructive for shared content**:
  `Review.userId`, `Comment.authorId` and `Report.reporterId` are now
  nullable with `onDelete: SetNull` instead of `Cascade`, so deleting an
  account detaches authorship instead of destroying content other users can
  still see or reply to — the UI falls back to a "Utilisateur supprimé"
  placeholder. A new `GET /users/me/deletion-summary` endpoint powers a
  collapsible per-category breakdown (deleted vs. anonymized) in the danger
  zone's confirmation modal.
- Settings/auth UX polish: login/register errors render in a `Banner` with
  clearer French copy, username availability check gets fuller messages and
  a check/cross glyph, email verified/unverified status moves to a small
  icon, and the adult-content toggle is fully hidden (not just disabled)
  when the account isn't eligible.
- Admin: per-domain library stats added to the users section.
- Fixed the Collection grid's delete button being hover-only, leaving touch
  users no way to remove an item — long-press now opens a focus overlay
  (same pattern as comment threads) with a confirmation step.
- Button styles refactored across components for consistency, with a new
  compact modifier.
- Dead-code cleanup: unused shared DTOs, an unused `getMyLists` helper,
  `knip` config, and various imports/constants consolidated across
  components and routes.

## 1.4.0 — Public landing page & app routing overhaul

- **Public landing page** at `/`: a prerendered marketing page (hero, the six
  libraries, feature grid, hosted-instance vs self-hosting) replacing the
  redirect-to-login that used to greet anonymous visitors. Copy lives in
  `messages/{fr,en}.json` under `landing_*`; the only session-dependent part
  is the CTA, which becomes "Ouvrir l'app" once bootstrap resolves.
- **Routes restructured around an `/app` prefix**: every signed-in screen
  moved under `routes/app/` (`/app`, `/app/media/…`, `/app/settings`,
  `/app/admin/…`, `/app/u/:username`). Auth is now enforced by layout
  nesting instead of the hand-maintained `PUBLIC_ROUTES`/`AUTH_ROUTES`
  arrays in the root layout — `app/+layout.svelte` guards the app and owns
  its chrome, `(auth)/+layout.svelte` does the mirror redirect for
  already-signed-in visitors, and `(verification)/` holds the two
  email-verification screens that are reachable in either state. Auth URLs
  (`/login`, `/register`, `/forgot-password`, `/reset-password`,
  `/verify-email`) and `/legal/*` deliberately stay at the root.
- `ssr = false` moved off the root layout onto the three signed-in groups, so
  the landing page and the legal documents are prerendered (indexable, no
  blank frame) while the app itself stays a pure SPA. The one-shot
  session+config bootstrap moved out of the root layout into
  `src/lib/bootstrap.svelte.ts`, which the nested layouts gate on.
- API-emitted web paths (`Notification.url`, activity/report `href`, admin
  digest and preference links in emails), the PWA manifest `start_url` and
  shortcuts, and the service worker's notification-click fallback all carry
  the `/app` prefix now.
- Fixed a pre-existing type error in `SupportSection.svelte` (`recommended`
  was missing from three of the four support tiles, so the union type didn't
  expose it).
- Fixed a deep link being lost on login: the redirect to `/login` now carries
  the original path as `redirectTo`, and a successful login sends the user
  back there instead of always landing on `/app`.

## 1.3.0 — Calendar sync, feedback board & legal pages

- **Calendar subscription (.ics)**: `CalendarSubscribeModal` plus new API
  endpoints to fetch and regenerate a per-user calendar token — subscribe to
  your Loomkeep release calendar from Google/Apple Calendar rather than
  checking the in-app one.
- **Feedback board (Quackback)**: self-hosted Quackback instance
  (feedback.loomkeep.app) wired into the app — `WidgetIdentify.svelte`
  authenticates the visitor via a signed SSO token so the widget knows who's
  asking. Three boards (Feature Requests, Bug Reports, both public;
  Internal Roadmap, team-only for business-sensitive backlog), two roadmaps
  and a changelog feed mirroring this file in user-facing language — see
  "Feedback board (Quackback)" in `CLAUDE.md` for the full setup and
  conventions.
- **Help & Feedback**: a new `/settings` section and home page card
  surfacing the feedback board (suggest an idea, report a bug, view the
  roadmap, see what's new) plus a button to open the support chat directly
  — the always-available entry point now that the floating launcher is
  hidden on mobile (see below).
- **Legal pages**: CGU (terms of service) and privacy policy documents
  added, legal links updated to open in a new tab.
- **Password requirements**: a new `PasswordRequirements` component and
  centralized password-validation module show live strength feedback on
  signup/change forms instead of a plain reject-after-submit.
- `NewBadge` component: a reusable "New" badge (paired with
  `feature-badges.ts`'s time-based `isFeatureNew()`) now used consistently
  across nav items, settings toggles and home cards instead of one-off
  markup per feature.

## 1.2.0 — Multilingual, release changelog & push onboarding

- **Paraglide i18n**: the web app is now translatable — English ships as the
  second locale alongside French, `User.locale` persists the choice across
  devices, and a language picker lives in Réglages → Apparence. Migrated
  component by component (transverse/nav/auth, settings, profile/social,
  admin layout/jobs/schema/services, admin stats) rather than in one pass,
  extracting shared `common_*` keys along the way.
- **Release changelog & newsletter**: a new `ChangelogEntry` model (version/
  title/highlights, admin-authored via `/admin/changelog`) feeds a public
  `/changelog` page — linked from the `Loomkeep vX.Y.Z` footer on `/settings`
  and `/admin` — and an opt-in `notifyNewsletter` email. `MailService` gained
  a `newsletter` template (admin gallery, new `multiline` field support for
  the highlights textarea) and `sendNewsletter()`; sending is a deliberate
  per-entry admin action (`POST /admin/changelog/:id/send`, resendable), never
  automatic on entry creation.
- **Push notification onboarding**: a one-time explanation prompt on app open
  (root layout), gated on `Notification.permission === "default"` plus a
  per-device localStorage flag — the two together distinguish "never asked"
  from "our own intro already shown and answered", since the browser
  permission alone can't tell those apart.
- **Notification bell popover**: `/notifications` is gone, replaced by a
  global bell popover reachable from anywhere (bottom-right on mobile); the
  last `readAt`/`notifyInApp` remnants from the old page were removed.
- **Self-host**: a file-toggled maintenance mode in Caddy, a
  `REGISTRATION_ENABLED` flag to close signups on an instance, and Cloudflare
  Turnstile bot protection on registration (installs without a Turnstile key
  see no widget, and the API no-ops the check the same way).

## 1.1.0 — Profile pictures & profile sharing

- **Profile picture upload**: `User.avatar` (bytes, stored in-row so it rides
  along with `pg_dump` backups rather than needing a separate volume) plus
  `avatarMimeType`/`avatarUpdatedAt`. New endpoints `PATCH`/`DELETE
/users/me/avatar` (size + magic-byte validated) and a public `GET
/users/:id/avatar` (no auth — a plain `<img src>` can't send the JWT kept
  in localStorage; cuids are unguessable enough). The web client resizes to a
  square (canvas, WebP) before upload. `avatarUrl` is now carried on
  `UserDto`/`UserSummaryDto`/`SocialProfileDto`/`ActivityActorDto`/
  `AdminUserDto`; a Figurant (Ghost mode) never exposes their real avatar —
  same anonymization path as their username/pseudonym.
- **Profile sharing**: a "Partager" action (Paramètres → Profil, and on your
  own public profile page) opens the native OS share sheet
  (`navigator.share`) where supported, falling back to a link-copy + QR code
  modal otherwise. A separate always-available "QR code" action covers the
  in-person case (someone scanning your screen) on every device, mobile
  included. The QR encodes the plain profile URL (`/u/username`), so it's
  scannable by any camera, not just the app. New dependency: `qrcode`
  (client-side SVG generation, no external calls).

## 1.0.1 — Rebrand: Tracklore → Loomkeep

The project is renamed to **Loomkeep** (loom — weaving together everything you
watch, read, play and listen to; keep — safekeeping), matching the
`loomkeep.app` domain. No behaviour changes: this release is a rename across
every surface, verified by a full build, the API unit suite and
`svelte-check`.

- **Workspace scope** renamed `@tracklore/*` → `@loomkeep/*` (root package
  `tracklore` → `loomkeep`), touching all three workspaces and every
  cross-package import, plus the `--filter` invocations in both Dockerfiles,
  the CI workflow, `.husky/pre-push` and the `/admin/schema` command hints.
- **Defaults** in `docker-compose.yml`, `docker-compose.prod.yml`,
  both `.env.example` files, and the CI Postgres service: database user/name
  are now `loomkeep`, and `SMTP_FROM` defaults to
  `Loomkeep <noreply@loomkeep.app>`. Safe to change wholesale — no
  production instance exists yet, so there is nothing to migrate. An existing
  local `tracklore-dev-db` container keeps its own name and credentials until
  it is recreated.
- **User-facing strings**: page title, sidebar wordmark, PWA manifest
  `name`/`short_name`, the version line in `/settings` and `/admin`, admin
  push/broadcast placeholders, and all transactional email copy (subjects,
  bodies and the shared mail header/footer).
- **Stored keys and generated filenames**: the localStorage token key
  (`tracklore.tokens` → `loomkeep.tokens` — logs existing sessions out once,
  acceptable pre-launch), the service-worker notification tag, the
  MusicBrainz `User-Agent`, the Swagger title, and the `loomkeep-*` prefixes
  on data exports and database backups.
- **Docs** (`README.md`, `CLAUDE.md`, `SECURITY.md`, `MONETIZATION-IDEAS.md`)
  updated. Historical changelog entries are deliberately left untouched —
  each documents what shipped under the name in use at the time. The GitHub
  and Codecov badge URLs still point at `Logan2234/tracklore` and will be
  updated once the repository itself is renamed.

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
  allow both `localhost`).

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
  transactional/notification email via SMTP, PWA mobile access.
  Native (Capacitor) wrapper still outstanding.
