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

**Chaque table n'est écrite que par son module propriétaire** (complément du
26/11/2026). Le propriétaire est le dossier de `src/` qui porte le nom du
fichier de schéma où la table est déclarée : `games.prisma` → `games/`.
Le media a d'abord été découpé entre `catalog.prisma` et `library.prisma`,
puis réuni en `media.prisma` quand son module `media/` a réuni `catalog/` et
la partie media de `library/` (API-04). Un autre module qui doit changer la table appelle le
propriétaire (un writer comme `users/user-url-token.writer.ts`, ou un service)
ou publie un événement qu'il écoute (ADR 0010). Les lectures restent libres.

`src/table-ownership.spec.ts` le vérifie sur les écritures Prisma
(`create`, `update`, `upsert`, `delete` et leurs variantes `Many`). Deux
dérogations y sont nommées :

- les copropriétaires, quand deux modules partagent vraiment une table :
  `User`, dont auth écrit les identifiants et les seconds facteurs, et account
  le calendrier de suppression ;
- les franchissements antérieurs à la règle, chacun avec sa raison (purge de
  la suppression de compte, cron de nettoyage des secrets d'auth…). Cette
  liste ne fait que rétrécir : une entrée qui ne correspond plus à aucune
  écriture fait échouer le test.

## Conséquences

- Renommer une colonne lue par plusieurs modules se fait dans le fichier
  `*.queries.ts` du propriétaire ; le typage signale les appelants à adapter.
- Les services gardent l'accès direct à Prisma, transactions comprises : pas de
  couche à traverser pour une requête simple.
- Une nouvelle écriture hors du propriétaire échoue en CI ; la corriger, c'est
  passer par le propriétaire, pas allonger la liste.
- Le test lit le source : une écriture imbriquée (`user.update({ data: {
preferences: { upsert: … } } })`) ou un modèle atteint par une variable lui
  échappe. La règle reste valable pour elles.
- Les lectures ne sont pas encore encadrées (`User` est lu par 19 modules) :
  ce serait l'étape suivante, avec les requêtes nommées pour point d'appui.
