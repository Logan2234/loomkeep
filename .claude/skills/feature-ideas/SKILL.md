---
name: feature-ideas
description: Product exploration for Loomkeep — surfaces new features, business improvements and integrations, grouped by category with effort/gain estimates, as a filterable HTML artifact. Use when Logan asks for "des idées de features", "des nouvelles fonctionnalités", "des pistes d'amélioration métier", or a product/roadmap brainstorm.
---

# Feature ideas

Product exploration, not code review. The question is _what Loomkeep should do next_, given
what it already is: a self-hosted, open-core tracker for series, movies, anime, games, books
and music, with a hosted VPS instance and a premium seam that isn't sold yet.

The deliverable is a filterable HTML artifact of grouped, estimated ideas Logan triages, then
feeds into Quackback (see "Hand it over").

**Each run stands alone.** Don't diff against a previous exploration — read the product as it
is today. Reference IDs are stable within a report, not across runs.

## What separates a good idea from filler

Three tests, in order. An idea that fails the first two is noise.

1. **Does the data already exist?** The highest-value ideas here are almost always _exposure_,
   not construction — something the app already computes, stores or fetches and simply never
   shows. Those are small-effort, high-gain, and they're what to lead with.
2. **Does it fit the positioning?** Self-hosted and AGPL. An idea that requires shipping user
   data to a third party, or that only works on the hosted instance, is a positioning decision,
   not a feature — say so explicitly rather than proposing it silently.
3. **Does it already exist?** Check the routes and the message catalogues before proposing
   anything. Proposing a feature that shipped last month destroys trust in the whole list.

## 1. Read the product, not the code paths

Different reading order from `project-audit` — you're looking for latent capability and gaps,
not defects:

- **The schema is the idea generator.** Read `apps/api/prisma/schema.prisma` end to end and
  list every column, table and relation that is populated but under-exploited. Ask of each one:
  who would want to see this, and where? (`SecurityEvent`, `ActivityEvent.domain`, `ListMember`,
  `ReadingGoal`, `*Replay`, `ownershipStatus`, `MediaExternalId` are the kind of rows that carry
  more product than they currently deliver.)
- **Provider payloads.** Read each `*.provider.ts` mapper and compare what the upstream API
  returns against what the DTO keeps. Discarded fields are free features.
- **Domain asymmetry.** The six domains are deliberately uneven. Walk them side by side and note
  where one has an affordance the others don't — a mechanic proven in one domain and missing in
  three is a cheap, coherent extension.
- **The route map.** `ls -R apps/web/src/routes/app/` gives the surface as a user experiences it.
  Read it as a menu: what would someone reasonably expect to find here and not find?
- **Import sources.** `apps/api/src/import/sources/` plus the shared base classes — the base
  does the analyze/resolve/commit work, so a new source is mostly a parser. Missing sources are
  adoption blockers, not conveniences.
- **The premium seam.** `EntitlementService`, `isEffectivelyPremium`, `FeatureFlagsService`, and
  `docs/adr/0001-open-core-agpl.md`. Any idea worth money should say so; any idea that must stay
  free for the self-host story should say that too.
- **Gamification and social**, which exist to create return visits — read `xp-rules.ts`, the
  achievements registry and the leaderboard for incentives that are mis-shaped or absent.

## 2. Categories and reference IDs

| Category                           | Prefix   |
| ---------------------------------- | -------- |
| UX & usage quotidien               | `UX-nn`  |
| Domaines & catalogues              | `CAT-nn` |
| Imports & intégrations             | `INT-nn` |
| Social & communauté                | `SOC-nn` |
| Administration & exploitation      | `ADM-nn` |
| Gamification & rétention           | `GAM-nn` |
| Confiance, vie privée & conformité | `TRU-nn` |

Add a category if the exploration warrants one. Aim wide — 30 to 40 ideas across every category
is the right order of magnitude; a short list of only safe ideas isn't useful for triage.

Every idea carries:

- a **short title** and a description of **two to four sentences**;
- an **effort** estimate (`petit` / `moyen` / `gros`) and a **gain** estimate (`petit` / `moyen` /
  `gros`) — both are required, and they're what Logan actually sorts on;
- the **files or models it builds on**, so the starting point is obvious;
- when relevant, an explicit **premium / gratuit** note, and a **dependency** note when one idea
  only makes sense after another.

Write each description so it says _why now_ and _what it leans on_, not just what it is.
"`ReadingGoal` only exists for books, but its gauge, dashboard card and edit modal are already
built — reusing them for '50 films en 2027' is UI that already exists" is an idea. "Ajouter des
objectifs annuels" is a title with nothing behind it.

## 3. Deliver as an artifact

Load the `artifact-design` skill first, then publish with the `Artifact` tool.

Required interactions:

- Filter by category, by effort, and by gain — multi-select within a group, AND across groups.
- Free-text search, accent-insensitive
  (`normalize("NFD").replace(/[\u0300-\u036f]/g, "")`).
- A checkbox per idea so Logan can mark what he's retained, with a visibly distinct state and a
  running count.
- Per-category counters that follow the active filters, and an empty state.

Since effort and gain are the two axes that drive triage here, give them real visual weight —
this page is a decision surface, not a document. A quadrant view (fort gain / faible effort in
the corner that matters) or a sortable gain-vs-effort layout earns its place if it stays legible
in both themes.

**Visual identity: reuse the project's own.** `apps/web/DESIGN.md` defines "Séance" — projector
amber accent, Bricolage Grotesque / Hanken Grotesk / Space Mono, the light and dark palettes,
and the mono-timecode device. Take the palette values from that file. Keep amber for the accent
alone and give the effort/gain scales their own distinct hues.

Both themes are required, tokens declared on bare `:root` first — see `artifact-design`.
Put the run's date in the page title.

## 4. Hand it over

Publish, then in chat give Logan the link plus the three or four ideas you'd build first, each
in one or two sentences with its reference ID — and say _why those_, usually because the data
is already there.

Ideas Logan retains go to Quackback, not to GitHub Issues: **Feature Requests** (public) or
**Internal Roadmap** (private, business-sensitive) — the split is a judgement call about whether
the idea reveals strategy, so ask rather than assume. Use the `create-ticket` skill to create
them and attach them to the matching roadmap; it handles the board/roadmap ID lookup and the
`PATCH`-after-create gotchas. Never create tickets in bulk without Logan naming which ideas —
a board flooded with speculative entries is worse than no board.
