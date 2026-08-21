# ADR 0001 — Positionnement open-core sous AGPL

**Statut :** Acceptée
**Contexte GitHub :** [loomkeep-roadmap#7 (LK-X10)](https://github.com/Logan2234/loomkeep-roadmap/issues/7)
**Bloque :** LK-D01 (rédaction des CGV)

## Contexte

Loomkeep est publié sous AGPLv3 (`LICENSE`). `User.entitlements` (Json,
`apps/api/prisma/schema.prisma`) prépare un plan payant, aujourd'hui inutilisé.

Développées dans ce monorepo AGPL, les fonctionnalités premium seront
distribuées comme le reste du code : un self-hoster pourra légalement
récupérer les sources, y compris le code premium, et se l'auto-héberger. Ce
n'est pas un défaut de conformité — c'est la conséquence assumée du choix de
licence — mais ça détermine ce que l'offre payante peut promettre, donc le
contenu des CGV (LK-D01).

Deux options étaient sur la table :

- **(a)** Assumer que le premium se vend comme **service géré** (hébergement,
  confort, seuils desserrés) et non comme logiciel exclusif — cohérent avec
  l'esprit du projet.
- **(b)** Isoler les fonctionnalités payantes dans un dépôt séparé sous une
  autre licence, pour empêcher légalement l'auto-hébergement du premium.

## Décision

**Option (a), à la Grafana** : le code premium reste dans le monorepo AGPL.
Le premium est vendu comme service géré, mais reste **aussi disponible en
self-hosting** (activable par clé/licence) — pas seulement sur l'instance
hébergée par Logan.

(b) est écartée : isoler le code dans un dépôt séparé sous licence
propriétaire aurait été le seul moyen d'empêcher légalement l'auto-hébergement
du premium, mais casse la promesse d'auto-hébergement complet du projet et
complexifie l'archi (frontière technique dure autour de `entitlements`) pour
un bénéfice que la section suivante montre limité de toute façon.

### Quota ou feature complète : un choix produit, pas une contrainte AGPL

Le code de gating (`entitlements`) est lui-même dans le monorepo AGPL, donc
lisible et patchable par tout self-hoster — qu'il s'agisse d'un check de
quota ("`N` listes en gratuit") ou d'un flag de feature complète ("export
iCal réservé au premium"). Les deux offrent exactement la même protection
technique, c'est-à-dire aucune, face à quelqu'un qui lit le code : l'AGPL ne
privilégie pas l'un par rapport à l'autre.

Le choix entre seuil et feature complète est donc un arbitrage produit
au cas par cas (ex. : desserrer le nombre de listes collaboratives vs.
réserver entièrement l'export iCal au premium), pas une règle à appliquer
systématiquement — les deux styles sont légitimes et seront mélangés selon
ce qui fait sens pour chaque feature.

### Non-rétroactivité sur le code déjà distribué

L'AGPL ne permet jamais de reprendre à un self-hoster ce qu'une version déjà
publiée lui a donné : toute release taguée reste éternellement disponible et
modifiable pour quiconque l'a récupérée. Concrètement :

- Une feature déjà sortie en gratuit ne peut pas être retirée des sources —
  seule sa **disponibilité sur l'instance hébergée** peut évoluer, pour les
  **nouveaux** comptes/usages.
- Les comptes hébergés existants dont l'usage dépasse un futur seuil gratuit
  sont conservés tels quels (grandfathering) — on n'applique la limite qu'aux
  nouveaux usages, jamais rétroactivement.
- Un self-hoster technophile pourra toujours patcher une limite de quota
  côté source — c'est le prix assumé de l'AGPL, pas un problème à résoudre.

### Conséquence pour LK-D01 (CGV)

Les CGV doivent être honnêtes sur le fait que le code premium est
AGPL : elles vendent un service (hébergement, quotas desserrés, support,
accès anticipé), jamais une exclusivité logicielle. Ne pas promettre une
restriction que la licence ne permet pas de faire tenir.

## Hors périmètre de cette décision

- Le mécanisme technique de gating (module optionnel, vérification de
  licence, exposition via `/api/config`, etc.) — ticket d'implémentation
  séparé, une fois les premières features premium arrêtées.
- Le calendrier de lancement du premium (quand la base d'utilisateurs et le
  catalogue de features premium seront suffisants).
- La liste définitive des features premium — pistes évoquées : stats
  avancées, exports (ex. iCal), accès anticipé aux futurs domaines
  (musique, podcasts, jeux de société), quotas desserrés (ex. listes
  collaboratives illimitées).

## Conséquences

- `User.entitlements` reste dans le schéma AGPL principal, pas dans un dépôt
  séparé.
- Le style de gating (seuil desserré vs. feature complète réservée) se
  décide feature par feature, sans préférence de principe imposée par
  l'AGPL — dans les deux cas, un self-hoster qui lit le code peut le
  contourner ; c'est un coût assumé, pas un problème à corriger.
- LK-D01 peut être rédigé sur cette base.
