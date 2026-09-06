# Modèle de données

Vue d'ensemble des tables de `apps/api/prisma/schema.prisma` et de leurs
relations. Pour le diagramme visuel, voir [erd.md](./erd.md) (généré
automatiquement à chaque `prisma generate`, `DISABLE_ERD` en prod).

Cette doc est une vue d'ensemble navigable, pas un remplacement des
commentaires du schéma — pour le _pourquoi_ d'une table précise, se référer
aux commentaires dans `schema.prisma`, qui restent la source de vérité.

## Tables sans relation (aucune FK)

| Table            | Description                                                                   |
| ---------------- | ----------------------------------------------------------------------------- |
| `JobRun`         | Historique d'exécution des jobs planifiés (scan notifs, refresh catalogue…).  |
| `BackupFile`     | Métadonnées des dumps de sauvegarde stockés sur disque.                       |
| `ApiCallCounter` | Compteur d'appels par provider externe et par jour, pour le suivi de quota.   |
| `NewsletterSend` | Log d'envoi d'une newsletter suite à la publication d'un changelog Quackback. |

## Identité, sécurité, sessions

| Table                | Description                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `User`               | Compte utilisateur ; racine de quasiment toutes les autres tables.                                  |
| `RefreshToken`       | Session active d'un `User` (un appareil connecté), pivotée à chaque refresh.                        |
| `UserDevice`         | Historique durable des appareils déjà utilisés par un `User`, pour détecter une nouvelle connexion. |
| `UserToken`          | Lien à usage unique envoyé par email à un `User` (reset password / vérif email).                    |
| `EmailChangeRequest` | Demande de changement d'email d'un `User`, en attente de confirmation par code.                     |
| `SecurityEvent`      | Journal d'événements sensibles liés à un `User` (ou anonyme), pour l'admin.                         |
| `PushSubscription`   | Abonnement Web Push d'un `User` sur un navigateur/appareil donné.                                   |
| `Notification`       | Notification in-app adressée à un `User`.                                                           |

## Médias (films/séries/anime)

| Table             | Description                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| `MediaItem`       | Œuvre média mise en cache localement dès qu'un `User` la référence.             |
| `MediaExternalId` | ID externe (TMDB/AniList/TVDB/IMDB) rattaché à un `MediaItem`.                  |
| `Season`          | Saison d'un `MediaItem`.                                                        |
| `Episode`         | Épisode d'une `Season`.                                                         |
| `LibraryEntry`    | Entrée de bibliothèque reliant un `User` à un `MediaItem` (statut, notes…).     |
| `EpisodeWatch`    | Un visionnage d'un `Episode` par un `User` (une ligne par vue, rewatch inclus). |

## Jeux vidéo

| Table            | Description                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| `GameItem`       | Jeu mis en cache localement dès qu'un `User` le référence.             |
| `GameExternalId` | ID externe (IGDB) rattaché à un `GameItem`.                            |
| `GameEntry`      | Entrée de bibliothèque reliant un `User` à un `GameItem`.              |
| `GameReplay`     | Un replay complété au-delà de la première complétion d'un `GameEntry`. |

## Livres

| Table            | Description                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| `BookItem`       | Livre mis en cache localement dès qu'un `User` le référence.                     |
| `BookExternalId` | ID externe (Open Library) rattaché à un `BookItem`.                              |
| `BookEntry`      | Entrée de bibliothèque reliant un `User` à un `BookItem`.                        |
| `BookReplay`     | Une relecture complétée au-delà de la première lecture d'un `BookEntry`.         |
| `ReadingGoal`    | Objectif annuel de lecture (nombre de livres) d'un `User` pour une année donnée. |

## Musique (en pause)

| Table             | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `MusicItem`       | Album précédemment mis en cache, conservé pendant la mise en pause. |
| `MusicExternalId` | ID externe (MusicBrainz) rattaché à un `MusicItem`.                |
| `MusicEntry`      | Entrée historique reliant un `User` à un `MusicItem`.              |

## Import

| Table       | Description                                                                         |
| ----------- | ----------------------------------------------------------------------------------- |
| `ImportRun` | Historique d'un import committé (TV Time/StoryGraph/Goodreads/Steam) par un `User`. |

## Social

| Table               | Description                                                                   |
| ------------------- | ----------------------------------------------------------------------------- |
| `VisibilitySetting` | Override de visibilité d'un `User` pour un couple (domaine, facette).         |
| `Follow`            | Relation de suivi dirigée entre deux `User`.                                  |
| `Block`             | Blocage dirigé entre deux `User`.                                             |
| `Review`            | Note/critique d'un `User` sur une cible polymorphe (œuvre, saison, épisode…). |
| `ReviewRevision`    | Snapshot historisé d'une modification d'une `Review`.                         |
| `ReviewVote`        | Vote (up/down) d'un `User` sur la `Review` d'un autre.                        |
| `Comment`           | Commentaire/réponse d'un `User` sur une cible polymorphe.                     |
| `CommentReaction`   | Réaction (emote) d'un `User` sur un `Comment`.                                |
| `Report`            | Signalement déposé par un `User` contre une cible polymorphe (modération).    |
| `List`              | Liste d'œuvres curée par un `User` (classée ou collection).                   |
| `ListMember`        | Droit d'édition accordé à un `User` sur la `List` d'un autre.                 |
| `ListItem`          | Une œuvre dans une `List`, avec sa position.                                  |
| `ActivityEvent`     | Événement du fil d'activité d'un `User` (ajout, terminé, noté…).              |
