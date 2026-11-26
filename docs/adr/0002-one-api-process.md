# ADR 0002 — Un seul processus API par instance

**Statut :** Acceptée — 26/11/2026, écrite après coup : elle consigne une
hypothèse que le code faisait déjà partout.

## Contexte

L'API tient plusieurs états dans la mémoire de son processus, sans rien
partager entre deux répliques :

| État                                   | Où                                    | Avec deux répliques                                                          |
| -------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| Jobs d'import (analyse, plan, commit)  | `ImportJobService.jobs` (`Map`)       | L'analyse faite sur l'une est introuvable depuis l'autre : import perdu.     |
| Limites de débit (`ThrottlerModule`)   | stockage mémoire par défaut           | Chaque réplique compte de son côté : la limite effective double.             |
| Temps réel (socket.io)                 | `EventsGateway`, sans adapter         | Un événement émis sur une réplique n'atteint pas les clients de l'autre.     |
| Cache « session encore valide » (30 s) | `SessionCacheService` (`Map`)         | Une révocation n'évince que le cache local : l'autre réplique l'ignore 30 s. |
| Tâches planifiées (`@Cron`, 17 jobs)   | `@nestjs/schedule`, dans le processus | Chaque réplique lance chaque job : digests et e-mails envoyés deux fois.     |

Aucune doc ne le disait, alors qu'un auto-hébergeur peut faire
`docker compose up --scale api=2` en une commande.

## Décision

Loomkeep tourne avec **un seul processus API par instance**. On monte en
charge verticalement : plus de CPU et de mémoire pour ce conteneur. La doc
d'auto-hébergement le dit (`self-hosting/requirements`, « One API container »).

Une seule exception, parce qu'elle coûte peu et que ses dégâts sont les plus
visibles : **les tâches planifiées prennent un verrou Postgres**
(`JobLockService`, `pg_try_advisory_xact_lock` dans une transaction qui dure
le temps du job). Une réplique qui trouve le verrou pris saute le tick ; un
« Lancer maintenant » sur un job en cours répond 409
(`admin.job_already_running`). Le verrou tombe avec la transaction, donc aussi
quand le processus meurt.

## Conséquences

- Les états de la table ci-dessus restent en mémoire, et c'est assumé. Le jour
  où plusieurs répliques deviennent nécessaires, il faudra pour chacun un
  stockage partagé (Postgres ou Redis) : jobs d'import persistés, stockage du
  throttler, adapter socket.io, invalidation de cache diffusée. C'est un
  chantier, pas un réglage.
- Un nouvel état en mémoire qui compte (file, cache, compteur) se signale
  dans cet ADR, en ajoutant une ligne à la table.
- Un job en cours bloque une connexion du pool, inactive, le temps de son
  exécution. Les jobs durent quelques minutes au plus et tombent rarement en
  même temps ; la transaction est bornée à 5 h (`MAX_RUN_MS`), en dessous du
  plus court intervalle de cron (6 h).
- Deux exécutions du même job ne se chevauchent plus, même dans un seul
  processus : un « Lancer maintenant » pendant le tick planifié est refusé au
  lieu de tourner en parallèle.
