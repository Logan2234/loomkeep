# ADR 0012 — Les effets de bord des bibliothèques passent par des événements

**Statut :** Acceptée — 28/11/2026. Complète [ADR 0010](0010-module-layers.md).

## Contexte

L'ADR 0010 réserve les événements aux remontées : un domaine appelle
directement `XpService` ou `ActivityService`, qui sont dans des couches
inférieures. Mais chaque domaine choisissait alors lui-même la raison d'XP et
le moment de l'attribuer, et écrivait ses posts d'activité. Une nouvelle règle
d'XP se codait dans quatre services, et un domaine qui oubliait un appel
n'était rattrapé que par `domain-parity.spec.ts` (audit d'architecture du
26/11/2026, API-08).

## Décision

**Une écriture de bibliothèque publie ce qui s'est passé**, avec les
événements communs aux quatre domaines de `apps/api/src/work/entry.events.ts` :

| Événement                 | Publié quand                                       | Qui réagit                                      |
| ------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| `EntryAddedEvent`         | une œuvre entre dans la bibliothèque (vrai ajout)  | gamification : WORK_ADDED, DOMAIN_STARTED       |
| `EntryStatusChangedEvent` | à chaque écriture d'une entrée                     | social : jalon de statut, FAVORITED             |
| `EntryCompletedEvent`     | l'entrée atteint le statut « fini » de son domaine | gamification : l'XP de complétion du domaine    |
| `EntryRemovedEvent`       | l'entrée est supprimée, avec les lignes emportées  | gamification : révocation de l'XP de ces lignes |

Les règles vivent chez qui les applique : `gamification/entry-xp.listener.ts`
(dont la table `COMPLETION_XP`, domaine → raison d'XP) et
`social/entry-activity.listener.ts`. Comme pour l'ADR 0010, la publication
passe par `emitAsync()`, attendu.

C'est une exception assumée à « on réserve l'événement aux remontées » : ici
l'événement descend, pour que la règle soit écrite une fois au lieu de quatre.

Les domaines y passent un par un. La musique publie ces événements ; media,
jeux et livres appellent encore `XpService` et `ActivityService` directement.

## Conséquences

- Une règle d'XP de bibliothèque s'écrit une fois, dans gamification, pour
  tous les domaines qui publient.
- Un événement porte des faits du domaine (l'entrée, les lignes supprimées par
  modèle Prisma), pas de vocabulaire d'XP : c'est gamification qui sait que
  l'XP d'une ligne `MusicEntry` est sourcée `MusicEntry`.
- Les tests d'un domaine construisent le bus avec les vrais écouteurs
  (`test-utils/entry-event-bus.ts`) : ils vérifient toujours l'XP et les posts
  qui en résultent, pas seulement la publication.
- Le temps de la migration, deux chemins coexistent : un domaine qui n'a pas
  encore migré garde ses appels directs.
