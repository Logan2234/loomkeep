# ADR 0006 — Les compteurs de progression tenus par des triggers Postgres

**Statut :** Acceptée — écrite le 26/11/2026 ; triggers ajoutés en octobre 2026
(migration `20261019160000_materialized_library_progress`, PRF-02).

## Contexte

Chaque page de la bibliothèque media agrégeait `Season × Episode × EpisodeWatch`
sur toute la bibliothèque pour trier et filtrer par progression : la requête
grossissait avec chaque épisode vu. Il fallait garder les totaux sur les
lignes. Restait à choisir qui les tient à jour.

Les visionnages s'écrivent par beaucoup de chemins : cocher un épisode, une
saison, « vu jusqu'ici », annuler, les imports en masse, la suppression d'un
compte ou d'une entrée en cascade, et les épisodes ajoutés ou retirés par le
rafraîchissement du catalogue.

## Décision

Trois colonnes sont **calculées par des triggers** au niveau de l'instruction
(`FOR EACH STATEMENT`), dans la même transaction que l'écriture :

- `MediaEntry.watchedEpisodes` : épisodes réguliers distincts vus ;
- `MediaEntry.lastWatchedAt` : dernier visionnage, épisodes spéciaux compris ;
- `MediaItem.episodeCount` : épisodes réguliers de l'œuvre.

L'application les lit et ne les écrit jamais.

## Conséquences

- Aucun chemin d'écriture ne peut oublier de mettre le compteur à jour, y
  compris un `createMany` d'import, un `deleteMany` ou une suppression en
  cascade, où aucun code applicatif ne s'exécute.
- Deux écritures simultanées ne se marchent pas dessus : le trigger recompte
  depuis les lignes, dans la transaction, au lieu d'incrémenter une valeur lue
  avant.
- Le calcul est invisible depuis le TypeScript : il se lit dans la migration.
  Écrire l'une de ces colonnes depuis l'app produirait une valeur aussitôt
  écrasée ou fausse, sans erreur. Un garde-fou dans les tests le signalerait
  (audit d'architecture du 26/11/2026, API-14).
