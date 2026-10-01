---
title: Concepts
description: Works, library entries, statuses, phases, history and cycles, as the API exposes them.
---

## Domains

Loomkeep tracks four domains: `MEDIA` (films, series and anime), `GAMES`,
`BOOKS` and `MUSIC` (albums). Each account turns on the ones it uses; the
API only returns the enabled ones, and asking for a disabled one with
`?domain=` is a `403` (`user.domain_disabled`).

## Works and entries

A **work** is a title from a catalogue: a film, a series, a game, a book, an
album. Its `id` is Loomkeep's own and the same for every account; `source`
and `sourceId` say which catalogue it comes from (TMDB, AniList, IGDB, Open
Library or MusicBrainz) and its id there, so you can match it elsewhere.

A **library entry** is your relation to a work: its status, rating, notes,
dates and progress. `GET /v1/library` lists entries, each carrying its work.
Entry ids are what `GET /v1/library/{id}` and the history take.

`progress` counts episodes for series and anime, pages for books and
playtime minutes for games; films and albums have none.

## Statuses and phases

Each domain has its own statuses (`WATCHING`, `PLAYING`, `TO_READ`,
`LISTENED`…). An entry keeps that `status` and adds a `phase`, the same
across domains, which is also what `?phase=` filters on:

| Phase         | Video                     | Games       | Books     | Music       |
| ------------- | ------------------------- | ----------- | --------- | ----------- |
| `PLANNED`     | `PLANNED`                 | `BACKLOG`   | `TO_READ` | `TO_LISTEN` |
| `IN_PROGRESS` | `WATCHING`                | `PLAYING`   | `READING` | —           |
| `DONE`        | `COMPLETED`, `UP_TO_DATE` | `COMPLETED` | `READ`    | `LISTENED`  |
| `DROPPED`     | `DROPPED`                 | `DROPPED`   | `DROPPED` | —           |

Video statuses follow from what you have watched; only `DROPPED` is set by
hand. `UP_TO_DATE` is a series or anime you have caught up with while it is
still airing.

## History and cycles

`GET /v1/history` lists what happened, newest first: episodes and films seen,
game and reading sessions, games, books and albums finished. `from` and `to`
narrow it to a window: `to=2026-09-30` includes that whole day.

Watching a film again, replaying a game or rereading a book starts a new
**cycle**. Each event carries `cycle`, the viewing, playthrough or reading it
belongs to: 1 for the first, 2 for a first rewatch.

Imports often bring viewings without a date. Those can't fall in a window,
so they only show in their entry's own history,
`GET /v1/library/{id}/history`, last and with a null `date`.

## Calendar

`GET /v1/calendar` lists the episodes airing from today on for the shows you
follow (dropped ones excluded), up to 90 days ahead and 60 episodes. Each one
says how many aired episodes of the same show you haven't watched yet
(`episodesBehind`).

## Lists

`GET /v1/lists` returns your own lists and, when the instance has its social
features on, the ones shared with you to edit. An item can be a work, a
season or an episode.
