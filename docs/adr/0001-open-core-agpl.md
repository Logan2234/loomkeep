# ADR 0001 — Positionnement open-core sous AGPL

**Statut :** Acceptée — complétée le 24/09/2026 (emplacement du code premium : option B, voir « Mise en œuvre retenue »)
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

Deux options étaient posées au départ comme mutuellement exclusives — la
section "Décision" explique pourquoi ce cadrage était en fait trompeur :

- **(a)** Assumer que le premium se vend comme **service géré** (hébergement,
  confort, seuils desserrés) et non comme logiciel exclusif — cohérent avec
  l'esprit du projet.
- **(b)** Isoler les fonctionnalités payantes dans un dépôt séparé sous une
  autre licence, pour empêcher légalement l'auto-hébergement du premium.

## Décision

Le clivage initial (a) "tout AGPL" vs (b) "dépôt séparé propriétaire, donc
self-host premium impossible" était une fausse dichotomie : Grafana lui-même
fait les deux à la fois — cœur AGPL, **et** un module Enterprise séparé sous
licence propriétaire, mais toujours installable en self-host après achat
d'une licence. Isoler le code premium n'empêche donc pas le self-hosting du
premium ; ça change seulement qui reçoit le code par défaut (voir plus bas).

**Ce qui est tranché** : le premium est vendu comme service géré (hébergement,
confort, seuils desserrés), **jamais** comme exclusivité logicielle — cohérent
avec l'esprit du projet — et reste **disponible en self-hosting** (activable
par clé/licence), pas seulement sur l'instance hébergée par Logan. Ce
positionnement, et les règles de non-rétroactivité ci-dessous, ne dépendent
pas de l'endroit où vit le code.

**Ce qui était resté ouvert, tranché le 24/09/2026** : où vit le code premium.
Trois options ont été comparées — tout AGPL avec un guard `entitlements`, un
module séparé dans un dépôt privé (façon Grafana Enterprise), ou un dossier
`ee/` dans le monorepo sous licence commerciale (façon Cal.com, GitLab). C'est
la troisième qui est retenue : voir « Mise en œuvre retenue » plus bas.

### Aperçu du mécanisme (illustratif, le détail reste à concevoir)

`User.entitlements` porte un **statut** (`premium: true/false`, éventuellement
un tier), pas des valeurs numériques de quota — un quota gratuit ("3 listes
collaboratives") est une constante de config lue via `hasPremium(user) ?
Infinity : FREE_MAX`, pas une donnée stockée par utilisateur. Une entrée
`entitlements` ne porte de valeur par-utilisateur que pour les exceptions
réelles (deal négocié, grandfathering d'une feature devenue payante après
coup — voir plus bas).

L'activation diffère entre les deux publics :

- **SaaS hébergé** : Stripe (ou équivalent) mène toute la logique
  d'abonnement ; un webhook (`checkout.session.completed`,
  `customer.subscription.deleted`, etc.) met à jour `entitlements` par
  utilisateur. Révocation immédiate et fiable, puisque tout reste côté
  serveur de Logan.
- **Self-host** : pas d'abonnement révocable à distance possible sans
  phone-home (contraire à l'esprit self-host du projet). Le mécanisme
  envisagé est une **clé de licence signée par Logan** (clé privée hors de
  l'app), vérifiée offline par une clé publique embarquée dans le code —
  active le premium pour toute l'instance (un foyer = un opérateur, pas un
  flag par utilisateur individuel côté self-host).

  **Point de vigilance non résolu par cet ADR** : une clé signée offline n'a
  de date d'expiration que si elle en embarque une (`expiresAt` dans la
  charge signée) — impossible de facturer mensuellement et de révoquer une
  clé déjà distribuée à distance. Deux pistes, ni l'une ni l'autre tranchée
  ici : licence annuelle réémise manuellement à chaque paiement reçu, ou
  licence perpétuelle par version majeure (paiement unique, façon
  JetBrains). Un vrai contrôle périodique en ligne réglerait la révocation
  mais réintroduirait le phone-home qu'on cherche à éviter.

  **Tranché le 24/09/2026 : licence annuelle**, réémise à chaque paiement,
  sans phone-home (voir « Mise en œuvre retenue »).

### Le gating self-host est une friction, pas une protection technique — et ça dépend d'où vit le code

Dans les deux cas (monorepo ou module séparé), un self-hoster qui **a déjà
reçu** le code premium — parce qu'il l'a acheté, ou parce qu'il vit dans le
même repo que le reste — a les sources et les droits admin sur sa propre
machine : rien n'empêche de supprimer le guard, de commenter le check
`entitlements`, ou de patcher la vérification de licence. Aucun mécanisme
technique — signature ou pas — ne peut empêcher ça pour du code qui tourne
chez lui ; ce n'est pas une faille à corriger, c'est une conséquence
structurelle de l'open source, quel que soit le dépôt.

Là où le choix du dépôt change vraiment les choses, c'est **avant** l'achat :

- **Monorepo** : tout le monde qui clone Loomkeep pour les features
  gratuites reçoit aussi le code premium — payeur ou pas. Le guard est le
  seul obstacle, public, zéro effort à retirer, aucun achat requis.
- **Module séparé** : un self-hoster qui n'a jamais payé ne reçoit jamais le
  code premium du tout — rien à patcher, puisqu'il n'a rien.

Dans les deux cas :

- **De la friction** pour la grande majorité des self-hosters, qui n'iront
  pas forker et maintenir un patch à chaque mise à jour juste pour éviter de
  payer.
- **Un contrat clair** (CGV) : contourner le gating reste une violation des
  conditions, même si c'est techniquement possible — ça compte pour qui
  respecterait la limite par principe.
- Le profil capable de patcher proprement et de maintenir ce patch dans le
  temps n'aurait très probablement pas payé de toute façon — ce n'est pas
  un revenu perdu, dans les deux architectures.

**La seule protection réellement solide reste le SaaS hébergé** : le code
tourne sur les serveurs de Logan, pas chez l'utilisateur, donc personne ne
peut patcher un guard auquel il n'a pas accès. Les CGV ne doivent jamais
promettre côté self-host une garantie qu'aucune des deux architectures ne
peut tenir.

### Quota ou feature complète : un choix produit, pas une contrainte AGPL

Une fois que le self-hoster a reçu le code premium (quelle que soit
l'architecture retenue plus haut), un check de quota ("`N` listes en
gratuit") et un flag de feature complète ("export iCal réservé au premium")
offrent exactement la même protection technique, c'est-à-dire aucune, face à
quelqu'un qui lit le code : ni l'AGPL ni le choix d'architecture ne
privilégient l'un par rapport à l'autre à ce stade.

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

Les CGV vendent un service (hébergement, quotas desserrés, support, accès
anticipé) et, depuis l'option B, une licence d'usage des fonctionnalités
`ee/` pour l'auto-hébergement. Elles doivent rester honnêtes : le code `ee/`
est visible, et les quotas du cœur restent AGPL, donc contournables
légalement. Ne pas promettre une restriction que la licence ne permet pas de
faire tenir.

## Mise en œuvre retenue (24/09/2026) : dossier `ee/` sous licence commerciale

### Pourquoi cette option

- **Un module privé n'apporte presque rien de plus.** Sa seule protection
  supplémentaire : quelqu'un qui n'a jamais payé n'a pas le code. Mais le
  vrai frein au contournement est de maintenir un fork à chaque version, et
  il vaut autant avec un dossier `ee/`. Un module privé imposerait en échange
  deux dépôts, deux builds, un registre d'images privé et une génération
  OpenAPI séparée, pour un développeur seul.
- **Le code du front ne se cache pas.** Tout ce qui est dans le bundle
  SvelteKit est téléchargé par chaque navigateur ; seule la logique serveur
  aurait pu rester privée.
- **La protection est juridique, et elle est réelle.** Utiliser `ee/` en
  production sans clé est interdit par LICENSE-EE : contourner la
  vérification est une contrefaçon au sens du droit d'auteur, pas seulement
  une violation des CGV.

### Ce qui va dans `ee/`, ce qui reste dans le cœur

- **Dans `ee/`** (`apps/api/src/ee`, `apps/web/src/lib/ee`, sous
  [LICENSE-EE](../../LICENSE-EE)) : les fonctionnalités premium **entières**.
  Premières migrées : l'abonnement iCal au calendrier et les styles de
  navigation Dock et Board.
- **Dans le cœur AGPL** : les **quotas et paliers** de fonctionnalités
  gratuites (un import par domaine, digest quotidien), les stats avancées
  (calculées dans les mêmes requêtes que les stats gratuites) et les domaines
  en accès anticipé. Leur code est de toute façon public, puisque la
  fonctionnalité de base est gratuite : ce qui se vend là, c'est le service
  hébergé.
- **Déplacer une fonctionnalité déjà publiée a un effet**, même si les
  anciennes versions restent AGPL pour toujours : pour la garder
  gratuitement, il faudrait maintenir un fork à chaque nouvelle version.

### Règles techniques

- **Le cœur n'importe jamais `ee/`** (règle ESLint côté API ; seul
  `app.module.ts` enregistre `EeModule`). Le cœur AGPL doit fonctionner seul.
- **Chaque contrôleur `ee/` porte `EeLicenseGuard`** : sans licence, ses
  routes répondent 404, comme si elles n'existaient pas. Les routes gardent
  leur chemin d'avant la migration (les calendriers abonnés interrogent déjà
  `/library/calendar.ics`).
- **Côté web**, un écran `ee/` se verrouille avec `useEeLock()` : verrouillé
  pour un compte non premium, comme tout écran premium, et aussi sur une
  instance sans licence (`GET /api/ee/status`).
- **Les droits par utilisateur ne changent pas** : sur l'instance hébergée,
  `isEffectivelyPremium` reste le contrôle par compte.

### La clé de licence

- **Format** : une charge JSON (`licensee`, `expiresAt`) signée en Ed25519,
  vérifiée hors ligne au démarrage avec la clé publique embarquée dans le
  code (`LICENSE_PUBLIC_KEY`). Variable : `LOOMKEEP_LICENSE_KEY`.
- **Annuelle**, avec 14 jours de grâce après `expiresAt` pour qu'un
  renouvellement tardif ne casse rien. À expiration, les fonctionnalités
  `ee/` se désactivent sans toucher aux données.
- **Avant le lancement du premium**, tant que le flag `premium-features` est
  éteint, les fonctionnalités `ee/` restent actives partout sans clé :
  personne ne peut encore en acheter, donc aucun auto-hébergeur ne perd ce
  qu'il avait.
- **La clé privée ne quitte jamais la machine de Logan**
  (`~/.loomkeep/license-signing-key.pem`, à sauvegarder hors ligne : la
  perdre oblige à changer la clé publique, ce qui invalide toutes les clés
  émises). Signer une clé :
  `pnpm --filter @loomkeep/api ee:license sign <clé privée> <titulaire> <expiration>`.
- **Instance hébergée et dev local** : même chemin de code qu'un
  auto-hébergeur, avec une clé que Logan se signe lui-même (longue durée),
  sans aucun contournement dans le code. Les tests n'ont pas besoin de clé :
  le flag `premium-features` y est éteint.

### Contributions

Un CLA ([CLA.md](../../CLA.md)) est demandé avant toute contribution
extérieure : sans lui, une contribution au cœur, reçue sous AGPL
uniquement, ne pourrait plus être combinée avec le code `ee/`.

## Hors périmètre de cette décision

- Le premium « pour toute l'instance » côté self-host : une clé de licence
  auto-hébergée devra rendre premium tous les comptes de l'instance, sans
  passer par `UserEntitlement`. À faire avant le lancement de l'offre.
- Le calendrier de lancement du premium (quand la base d'utilisateurs et le
  catalogue de features premium seront suffisants).
- La liste définitive des features premium — pistes évoquées : stats
  avancées, exports (ex. iCal), accès anticipé aux futurs domaines
  (musique, podcasts, jeux de société), quotas desserrés (ex. listes
  collaboratives illimitées).

## Conséquences

- `User.entitlements` (le statut, dans `apps/api/prisma/schema.prisma`) reste
  dans le schéma AGPL principal, comme toutes les tables : le schéma n'est
  pas la valeur. Le code des fonctionnalités premium entières vit dans
  `ee/`.
- Le style de gating (seuil desserré vs. feature complète réservée) se
  décide feature par feature, sans préférence de principe imposée par
  l'AGPL — dans les deux architectures, un self-hoster qui a reçu le code
  peut le contourner ; c'est un coût assumé, pas un problème à corriger.
- LK-D01 peut être rédigé sur cette base : le positionnement service géré +
  self-host inclus + non-rétroactivité est stable, indépendamment de la
  question d'architecture encore ouverte.
