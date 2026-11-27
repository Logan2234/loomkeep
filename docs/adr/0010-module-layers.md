# ADR 0010 — Des couches de modules, et des événements pour remonter

**Statut :** Acceptée — 26/11/2026.

## Contexte

Le graphe des modules NestJS était acyclique (aucun `forwardRef`), mais par
discipline seulement : rien n'empêchait un module de base d'en importer un de
haut niveau. C'était déjà arrivé. `UsersModule`, importé par treize modules
pour deux gardes, importait `chat`, `social` et `reviews`, et `auth` importait
`social`. Le premier cycle se serait payé en `forwardRef`, puis en erreurs
d'injection au démarrage.

## Décision

Chaque module appartient à une couche et n'importe que des modules de sa
couche ou des couches inférieures :

| Couche          | Rôle                                              | Exemples                                                                    |
| --------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| infra           | Transport, stockage, configuration                | prisma, config, mail, events (socket.io), jobs, quota                       |
| plateforme      | Identité, droits et services transverses          | auth, entitlements, notifications, gamification, reports, `UserGatesModule` |
| communauté      | Ce que les membres partagent                      | social, reviews, comments, lists, chat (le service)                         |
| domaines        | Le catalogue et la bibliothèque de chaque domaine | media, games, books, music                                                  |
| transverses     | Ce qui croise les domaines                        | library (counts, calendar), links, search, stats, session-timer, creators   |
| fonctionnalités | Ce qui assemble tout                              | account, admin, import, public-api, users (`/users/me`), chat-api, ee       |

`apps/api/src/module-layers.spec.ts` porte la liste et échoue quand un module
importe une couche au-dessus de la sienne, ou quand un nouveau module n'a pas
de couche.

**Quand un module doit prévenir une couche supérieure, il publie un
événement** (`@nestjs/event-emitter`) au lieu de l'importer. Le module qui
publie déclare ses événements dans `<module>.events.ts` (une classe par
événement, avec son nom en constante `NAME`). Le module qui réagit s'y abonne
avec `@OnEvent` dans un `*.listener.ts`. La publication passe par
`emitAsync()`, attendu : les écouteurs s'exécutent avant que la requête
réponde, et leur erreur remonte comme avant.

Premiers événements : `PersonalInvitationAcceptedEvent` (auth → social, le
suivi mutuel du lien d'invitation) et `TotpEnabledEvent` (auth → gamification,
le succès locked_down).

Un appel vers une couche inférieure reste un appel direct : les domaines
appellent `XpService` ou `ReviewService` normalement.

## Conséquences

- On lit la place d'un module dans un seul fichier, et un import qui inverse
  le sens casse un test au lieu de passer en revue.
- `auth` ne connaît plus `social` ni `gamification` : il annonce ce qui s'est
  passé, et chaque module décide de ce qu'il en fait.
- Un événement est un nom à suivre : l'écouteur ne se trouve pas par « aller à
  la définition ». Le nom en constante et un fichier `*.events.ts` par module
  le rendent cherchable. On réserve l'événement aux remontées, pas aux appels
  ordinaires.
- Les effets de bord des domaines (XP, succès, activité) passent encore par
  des appels directs, autorisés puisqu'ils descendent. Les convertir en vrais
  événements de domaine (« épisode vu », « partie terminée ») déplacerait les
  règles d'XP dans gamification : c'est un chantier à part.
