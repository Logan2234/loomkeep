---
title: Catalogue keys
description: The API keys each catalogue and import needs, and where to get them.
---

Loomkeep searches catalogues live and copies a title only once someone
tracks it. Each catalogue has its own access rules:

| Catalogue / feature   | Variables                                  | Needed for                                             |
| --------------------- | ------------------------------------------ | ------------------------------------------------------ |
| TMDB                  | `TMDB_API_TOKEN`                           | **Required**: films and series.                        |
| AniList               | —                                          | Anime. No key.                                         |
| IGDB (through Twitch) | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Games. Without it, the games domain finds nothing.     |
| Open Library          | — (`API_CONTACT` recommended)              | Books. No key.                                         |
| MusicBrainz           | — (`API_CONTACT` recommended)              | Music. No key.                                         |
| OMDb                  | `OMDB_API_KEY`                             | Optional: IMDb, Rotten Tomatoes and Metacritic scores. |
| Steam                 | `STEAM_API_KEY`                            | The Steam import.                                      |
| Simkl                 | `SIMKL_CLIENT_ID`, `SIMKL_CLIENT_SECRET`   | The Simkl import.                                      |

An import whose key is missing is greyed out in the app; the rest keeps
working. **Admin › Services** shows which keys are set and whether each
service answers.

## TMDB

Create a free account on [themoviedb.org](https://www.themoviedb.org), then
in **Settings › API**, copy the **API Read Access Token** (the long one) into
`TMDB_API_TOKEN`.

## IGDB, for games

IGDB authenticates through Twitch. In the
[Twitch developer console](https://dev.twitch.tv/console/apps), register an
application (any name; OAuth redirect `http://localhost`), then copy its
**Client ID** and a new **Client Secret** into `TWITCH_CLIENT_ID` and
`TWITCH_CLIENT_SECRET`.

## Open Library and MusicBrainz

Both ask callers to identify themselves. Set `API_CONTACT` to an email
address or a URL where they can reach you: it goes in the `User-Agent` of
every call.

## OMDb

Get a free key at [omdbapi.com](https://www.omdbapi.com/apikey.aspx) for
IMDb, Rotten Tomatoes and Metacritic scores on detail pages. Its data is
under a non-commercial license.

## Steam

Get a key at [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
(any domain name) for the Steam import.

## Simkl

Simkl only lets users in through a sign-in on Simkl, which comes back to
**your** instance: each instance needs its own Simkl app. Create one at
[simkl.com/settings/developer](https://simkl.com/settings/developer/), with
the redirect URI set to exactly:

```
<WEB_ORIGIN>/app/settings/import/simkl/callback
```

for instance `https://loomkeep.example.com/app/settings/import/simkl/callback`,
then copy its Client ID and Secret into `SIMKL_CLIENT_ID` and
`SIMKL_CLIENT_SECRET`.

After changing keys, apply them with `docker compose up -d`.
