# ADR 0003 — Les catalogues en cache à la demande, pas en miroir

**Statut :** Acceptée — écrite le 26/11/2026, décision antérieure.

## Contexte

Loomkeep s'appuie sur un catalogue externe par domaine : TMDB (et AniList pour
l'anime), IGDB, Open Library, MusicBrainz. Deux façons de s'en servir : copier
ces catalogues dans notre base (un miroir), ou n'y stocker que ce que quelqu'un
suit.

## Décision

**Cache à la demande.** La recherche interroge le fournisseur en direct. Une
ligne `MediaItem`/`GameItem`/`BookItem`/`MusicItem` n'est créée que quand un
utilisateur commence à suivre l'œuvre, par le `upsertFromSource()` du domaine.
Elle est rafraîchie ensuite : TTL de 24 h (7 jours pour une série terminée), et
un job `refreshStale` toutes les 6 h pour le media, les jeux et les livres. La
musique n'en a pas : un album se rafraîchit quand quelqu'un le suit à nouveau.

## Conséquences

- Une instance auto-hébergée reste petite : elle ne contient que ce que ses
  utilisateurs suivent, et elle respecte les conditions d'usage des fournisseurs
  (pas de copie intégrale).
- La recherche dépend de la disponibilité du fournisseur ; une œuvre déjà suivie
  reste affichable depuis le cache quand il est en panne.
- Un rafraîchissement ne supprime jamais de saisons ni d'épisodes, pour que les
  `EpisodeWatch` gardent une cible valide.
- Les quotas des fournisseurs comptent : `QuotaTrackerService` (module `quota/`)
  compte chaque appel, et Admin alerte à l'approche d'une limite quotidienne.
