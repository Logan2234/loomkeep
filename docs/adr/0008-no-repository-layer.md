# ADR 0008 — Pas de couche repository, des requêtes nommées chez le propriétaire

**Statut :** Acceptée — 26/11/2026.

## Contexte

Les services de l'API appellent Prisma directement (`this.prisma.user.findMany(…)`),
environ 1 350 appels hors tests. La question revient régulièrement : faut-il
une couche repository (`UserRepository.findById()`, `GameEntryRepository.save()`)
entre les services et la base, comme dans une architecture en couches classique ?

Ce qu'on cherche vraiment, c'est la séparation des responsabilités : qu'un
changement sur la table `User` ne se fasse qu'à un endroit. Or la même forme
de requête « carte d'utilisateur » (`id, username, displayName, profileAccess,
avatarUpdatedAt`) était recopiée dans sept modules.

## Décision

**Pas de couche repository générique.** Prisma est déjà un data mapper typé :
le type renvoyé se déduit du `select`, ce qu'une méthode `findById()` générique
fait perdre. Et un `UserRepository` injectable partout n'empêche pas plus le
couplage que `PrismaService` injectable partout : il le cache.

**À la place, des requêtes nommées chez le module propriétaire.** Une forme de
requête (`select`/`include`, écrite `satisfies Prisma.…`) ou une requête que
d'autres modules réutilisent vit dans `<module>/<modèle>.queries.ts`, à côté du
fichier de schéma du même module (`prisma/schema/<module>.prisma`), et n'est
exportée que de là. Premier exemple : `users/user.queries.ts` et son
`USER_SUMMARY_SELECT`, que les sept modules importent ; ceux qui ont besoin de
plus l'étendent (`{ ...USER_SUMMARY_SELECT, preferences: … }`).

On ne crée pas de requête nommée par principe : une requête qu'un seul service
utilise reste dans ce service.

## Conséquences

- Renommer une colonne lue par plusieurs modules se fait dans le fichier
  `*.queries.ts` du propriétaire ; le typage signale les appelants à adapter.
- Les services gardent l'accès direct à Prisma, transactions comprises : pas de
  couche à traverser pour une requête simple.
- La règle ne dit pas encore _qui_ a le droit d'écrire une table. C'est l'étape
  suivante (propriété des tables, vérifiée par un test sur les écritures).
