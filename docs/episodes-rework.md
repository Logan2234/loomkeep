# Episodes & seasons rework — spec

Agreed with Logan on 2026-10-14 from the "Épisodes — 3 pistes" design canvas
(design **D · Hybride A + C**, last iteration). This is the brief for the
implementation; the canvas is a presentation mock, not a pixel reference — the
review modal and the discussion widget it sketches are **not** to be redrawn
(see "Reused as-is").

## Data to add

| Id  | Data                                                                    | Source                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Episode synopsis                                                        | TMDB season endpoint (`overview`) — already stored in `Episode.overview`, never displayed                                                                                                                                                                                              |
| T2  | Episode still                                                           | TMDB season endpoint (`still_path`) — already stored in `Episode.stillUrl` (w300); a larger size for the side panel                                                                                                                                                                     |
| T3  | TMDB rating + vote count per episode                                    | TMDB season endpoint (`vote_average`, `vote_count`) — new columns                                                                                                                                                                                                                       |
| T4  | Episode type (`standard` / `mid_season` / `finale`)                     | TMDB season endpoint (`episode_type`) — store it, **but no badge in the UI** (Logan: not useful). Keep for later use only if cheap; otherwise skip.                                                                                                                                      |
| T8  | Season poster, overview, premiere date, TMDB average                    | TMDB `tv.seasons[]` / season endpoint (`poster_path`, `overview`, `air_date`, `vote_average`) — new `Season` columns                                                                                                                                                                    |
| T9  | Episode title + synopsis in fr / it                                     | TMDB season endpoint queried once per supported locale (today it is queried with no language → English only). Needs a per-episode translation table (mirror of `MediaItemTranslation`), and season title/overview translations too.                                                     |
| A1  | Episode title (anime)                                                   | AniList `streamingEpisodes.title` — already used                                                                                                                                                                                                                                        |
| A2  | Episode thumbnail (anime)                                               | AniList `streamingEpisodes.thumbnail` (Crunchyroll CDN) — not queried today; same franchise-duplicate guard as titles (`sharesStreamingEpisodes`)                                                                                                                                       |
| A3  | Streaming link + site (anime)                                           | AniList `streamingEpisodes.url` / `site` — "Watch on Crunchyroll" button in the side panel                                                                                                                                                                                              |
| A4  | Exact air date + time (anime)                                           | AniList `airingSchedule { nodes { episode airingAt } }` (paginate; can be incomplete — e.g. Frieren starts at ep 5 — so `airDate` stays nullable)                                                                                                                                      |
| A5  | Duration (anime)                                                        | AniList `duration` — already copied onto every episode                                                                                                                                                                                                                                  |
| L1  | Full personal watch history (every view, dated)                         | `EpisodeWatch` rows — already returned (`watches[]`), only the first one is shown today                                                                                                                                                                                                 |
| L2  | My review on the episode / season                                       | existing reviews (`ReviewTargetType` EPISODE / SEASON)                                                                                                                                                                                                                                  |
| L3  | Loomkeep average + review count per episode / season                    | existing reviews — needs an aggregate in the season/episode payload (avoid N queries)                                                                                                                                                                                                   |
| L4  | Comment count                                                           | already shown by `CommentsPanel` (compact)                                                                                                                                                                                                                                              |
| new | Episode image gallery (slider) + trailers/clips in the side panel media | TMDB `/tv/{id}/season/{s}/episode/{e}` with `append_to_response=images,videos` — one call per episode, so **fetched live when the side panel opens** (like `getExtras`), never at upsert time, and cached. Videos are often empty per episode: the slider simply shows stills only then. |

Out of scope for now: **Kitsu** (K1–K4, needs ToS review for a commercial
app), **L5** (friends who watched it), episode crew / guest stars (T5, T6),
alternate episode orderings (T13).

Ratings must stay secondary: Logan's instance will have very few Loomkeep
ratings and TMDB has thin data on lesser-known shows. Show both TMDB and
Loomkeep values as quiet text, only when present — no rating chart, no
rating-first layout.

## Layout (design D, final)

### Page section

- Header line: "Épisodes" + a progress hint ("4 / 12 épisodes diffusés vus",
  "À jour · N épisodes vus", "Pas commencée").
- **Season cards** in a horizontal strip: poster, title, `watched/total`,
  TMDB season rating when present, progress bar along the bottom edge (green
  once complete). **No chevron. No review/comment buttons on the card.**
- Clicking a card toggles it: open → its summary + episode list appear;
  clicking the open card again closes it. **Zero open seasons is a valid
  state** (short page) — and then **no hint text** ("Choisis une saison…" is
  dropped).
- **Default selection** on arrival: the season currently being watched (the
  one holding the first aired-but-unwatched episode, once at least one
  episode is watched). **No season open** when the show is not started, or
  when everything aired has been watched (up to date / finished).

### Season summary block (when a season is open)

- Poster, "Synopsis de la saison" (anime: "Synopsis de l'animé · AniList"),
  premiere date, episode count, TMDB + Loomkeep averages when present.
- Overview clamped to 2 lines with "Lire la suite" / "Réduire".
- **The season's review button (★ count) and discussion button (💬 count)
  live here**, not on the card.
- "Marquer les diffusés comme vus" → becomes "Annuler la saison" once
  everything aired is watched (replaces today's ⋮ menu).

### Episode rows

- Still (16:9 thumbnail; watched check overlay; "dans N j" veil when not
  aired; placeholder icon when no image), code, title, `×N` when rewatched.
- Synopsis, 2 lines.
- Meta line: air date (anime: weekday + time), runtime, `TMDB x,x` and
  `Loomkeep x,x` when present, "Vu le …".
- Right side, always visible (no unfolding needed): **review button (★ +
  count, filled when I reviewed it)** and **discussion button (💬 + count)**,
  then "Marquer vu" / "Vu" / "dans N j".
- **No badges** (mid-season, season finale, next to watch) and no highlight of
  the next episode.
- Clicking the still or the title opens the episode side panel.
- Keep today's behaviours: catch-up prompt when marking past unwatched
  episodes, `#s2e5` deep-link scroll + highlight, season-finished message.

### Episode side panel

- Closed by default; opens on a row click; closes with ✕ (or re-clicking the
  same row). The list takes the full width while it is closed. Mobile: full
  screen with a back button.
- **Header: code + episode title** (not just the code), review + discussion
  icon buttons, close.
- **Media slider**: episode stills gallery + TMDB trailers/clips for that
  episode (live fetch, see "new" above), image source caption.
- Title, then a cell grid: air date, runtime, TMDB (rating + votes), Loomkeep
  (average + review count). Anime: streaming link instead where relevant.
- Synopsis (or "no synopsis yet on TMDB" / "AniList has no per-episode
  synopsis").
- Actions: "Marquer vu" (advances the panel to the next episode), or
  "Revoir" + "Annuler le dernier" once watched; "Regarder sur Crunchyroll"
  for anime.
- "Mon visionnage": every view as a small timeline (Vu le … / Revu le …).
- **Previous / next episode pinned to the bottom** of the panel (the body
  scrolls above it, so the buttons never move with synopsis length).

### Reused as-is

- Review: the existing season/episode review **modal**
  (`Modal` + `ReviewsSection compact`, as `EpisodesSection` does today).
- Discussion: the existing `CommentsPanel` (compact trigger) — side panel,
  or the chat widget's "Œuvres" tab when Messages is enabled. Not an inline
  tab in the episode panel.

### Optional, proposed in the mocks

- Spoiler protection: blur stills and hide synopses of unwatched episodes
  (except on demand). Not explicitly approved — ask before building it,
  possibly as an account preference.

## Implementation notes

- Prisma: new `Episode` columns (`tmdbRating`, `tmdbVoteCount`, `episodeType`
  if kept, `streamingUrl`, `streamingSite`), new `Season` columns
  (`posterUrl`, `overview`, `airDate`, `tmdbRating`), an episode/season
  translation table for T9. `Episode.overview` comment ("not shown yet") to
  update.
- `airDate` for anime becomes a timestamp with a time (A4); the web
  formatter must show the time only for anime.
- Refresh stays throttled by `lastSyncedAt`; a migration-time backfill is not
  needed (24h TTL refreshes rows as they are viewed).
- Public API (`/api/v1`) DTOs: every new field needs a JSDoc description and
  `@example`.
- Web: i18n keys for every new string (fr/en/it), motion per `DESIGN.md`,
  mobile check, a `"Nouveau"` badge in `feature-badges.ts`.
- Replace or update `EpisodesSection.svelte.spec.ts` alongside.
