# Décisions d'architecture

Une décision structurante, son contexte et ce qu'elle implique, en une page.
Un ADR se remplace par un nouveau, qui dit lequel il remplace ; il ne se
réécrit pas.

| ADR                                          | Décision                                                            |
| -------------------------------------------- | ------------------------------------------------------------------- |
| [0001](0001-open-core-agpl.md)               | Open-core sous AGPL, premium dans `ee/`                             |
| [0002](0002-one-api-process.md)              | Un seul processus API par instance                                  |
| [0003](0003-on-demand-catalog-cache.md)      | Les catalogues en cache à la demande, pas en miroir                 |
| [0004](0004-one-table-set-per-domain.md)     | Un jeu de tables par domaine                                        |
| [0005](0005-polymorphic-targets.md)          | Cibles polymorphes sans clé étrangère                               |
| [0006](0006-progress-counters-by-trigger.md) | Les compteurs de progression tenus par des triggers                 |
| [0007](0007-shared-package-compiled.md)      | `packages/shared` consommé compilé, en CommonJS                     |
| [0008](0008-no-repository-layer.md)          | Pas de couche repository, des requêtes nommées chez le propriétaire |
| [0009](0009-capacitor-remote-shell.md)       | L'app Android est une coque qui charge l'instance                   |
| [0010](0010-module-layers.md)                | Des couches de modules, et des événements pour remonter             |
