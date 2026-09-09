# Audit mobile — portrait & paysage

Relevé du 8 septembre 2026, sur `main` (v1.8.0), serveur de développement.

Parcours réalisé au navigateur, compte de test fraîchement créé (`qamobile`,
promu `ADMIN`, 4 domaines actifs), sur trois gabarits :

| Gabarit                | Viewport  | Layout activé          |
| ---------------------- | --------- | ---------------------- |
| Portrait (référence)   | 375 × 812 | `MobileLayout`         |
| Portrait étroit        | 320 × 568 | `MobileLayout`         |
| Paysage (iPhone 13/14) | 812 × 375 | `DesktopSidebar` (†)   |
| Paysage (Pro Max)      | 932 × 430 | `DesktopSidebar` (†)   |
| Desktop (comparaison)  | 1440× 900 | `DesktopSidebar` + TOC |

(†) au moment du relevé ; depuis le correctif M-01, le paysage téléphone
conserve le shell compact.

Écrans visités : landing publique, inscription, vérification e‑mail,
onboarding (4 étapes), accueil, recherche (4 domaines), fiche série + liste
d'épisodes, bibliothèques (vidéo / jeux / livres), calendrier, listes,
critiques, fil d'activité, statistiques, succès, classement, profil privé,
profil public, paramètres, import, sessions, poste de contrôle admin,
utilisateurs, statistiques d'instance, jobs, signalements, schéma, menu
mobile, modale de création de liste.

Chaque constat porte un identifiant (`M-xx`) pour pouvoir être repris tel quel
dans un ticket ou une session de correction.

**État au 8 septembre 2026** — M-01 à M-06, M-08 et M-10 sont corrigés sur la
branche `fix/mobile-audit-p0-p1` et ont été retirés de ce document. M-07 est
partiellement corrigé (requalifié P2). M-09 reste ouvert volontairement.
M-27 et M-28 ont été découverts pendant la correction, ainsi que M-29
(corrigé) — un débordement horizontal du profil signalé par Logan.

**M-29 · Débordement horizontal du profil** (corrigé) — un titre saisi par un
utilisateur et sans espace (nom de liste, titre d'œuvre) a une largeur
min-content égale au mot entier : il élargissait la page bien au-delà du
viewport et produisait un ascenseur horizontal. Deux causes cumulées, et un
piège au passage : `break-words` (`overflow-wrap: break-word`) coupe les
glyphes à l'affichage mais **ne réduit pas** la largeur min-content, donc il ne
règle rien ici — il faut `wrap-anywhere` (`overflow-wrap: anywhere`). Appliqué
au titre de repli de `Poster`, aux phrases de `ProfileActivity` et
`ActivityItem`. Deuxième cause : les items du grid de `ProfileView` n'avaient
pas `min-w-0`, or un item de grid vaut `min-width: auto` par défaut — le
carrousel de listes, que `-mx-5` élargit de 40 px, poussait donc sa colonne de
33 px. Vérifié sans débordement de 320 à 414 px.

**Rectification sur M-01** (retiré) : la première rédaction affirmait qu'en
paysage quatre destinations étaient « inaccessibles » et que deux réagissaient
au mauvais clic. C'était faux. Le `<nav>` du rail porte déjà
`overflow-y-auto` : `scrollHeight` valait 514 px pour 194 px utiles, et les
entrées manquantes étaient atteignables au défilement. Les positions que
j'avais relevées décrivaient l'état non défilé, et `elementFromPoint` renvoyait
le bloc bas parce que la liste est _clippée_ à cet endroit, pas parce qu'elle
est recouverte. Le vrai défaut était plus modeste : quatre entrées visibles sur
dix dans une liste dont la barre de défilement est masquée
(`scrollbar-width: none`), avec deux dégradés de 20 px comme seul indice. Le
correctif retenu — garder le shell compact sous 600 px de hauteur — traite
cela ainsi que M-06 et M-07, puisque la barre du bas et le MenuSheet sont
conçus pour ces hauteurs.

---

## Priorité 1 — majeur

### M-09 · Cibles tactiles très en dessous du minimum recommandé

Recommandation usuelle : 44 × 44 px (Apple HIG) / 48 × 48 dp (Material).
Relevé, hors éléments purement décoratifs :

| Élément                                 | Écran                | Taille   |
| --------------------------------------- | -------------------- | -------- |
| Puces du carrousel de casting           | fiche œuvre          | 6 × 6    |
| « Modifier le profil » (crayon)         | profil               | 22 × 22  |
| Retour (chevron) des sous‑pages         | toutes sous‑pages    | 24 × 24  |
| `Switch` (notifications, MFA, domaines) | paramètres, onboard. | 40 × 24  |
| « ▶ S01E05 » (action principale)        | accueil              | 112 × 24 |
| Puces de visibilité (Public/Amis/…)     | paramètres           | 53 × 24  |
| Actions d'épisode (étoile, ⋯, ✕)        | fiche série          | 28 × 28  |
| Actions de saison                       | fiche série          | 28 × 28  |
| « Changer la photo de profil »          | profil               | 28 × 28  |
| « + Ajouter à la bibliothèque »         | recherche            | 32 × 32  |
| Actions de modération                   | admin/signalements   | 26 h     |
| Boutons du wizard d'onboarding          | onboarding           | 36 h     |
| Onglets de domaine                      | recherche            | 37 h     |
| Puces de filtre (Statut, Tri, ↓)        | bibliothèques        | 34 h     |

Le plus gênant est « ▶ S01Exx » sur l'accueil : c'est le geste principal de
l'app (marquer l'épisode suivant comme vu) et il fait 24 px de haut.

**Remédiation recommandée** : ne pas gonfler les composants visuellement, mais
étendre la zone tactile — c'est la manière d'y arriver sans casser la densité
du design « Séance ».

```css
/* Zone tactile de 44px sans changer la taille visible du contrôle. */
.touch-target::after {
  content: "";
  position: absolute;
  inset: 50% auto auto 50%;
  width: max(100%, 44px);
  height: max(100%, 44px);
  transform: translate(-50%, -50%);
}
```

À appliquer aux classes partagées (`.btn-icon`, `.switch`, `.chip`, les
boutons d'action d'épisode) plutôt qu'au cas par cas. Pour « ▶ S01Exx »,
supprimer `btn-sm` sous `sm` et passer le bouton en pleine largeur de sa
carte. Pour les puces du carrousel, soit les agrandir à 24 px de zone tactile,
soit les rendre purement indicatives (`pointer-events-none`) puisque le
carrousel se fait déjà au doigt.

---

---

## Priorité 2 — moyen

### M-07 · Les actions d'une modale ne sont pas ancrées

**Fichier** : [apps/web/src/lib/components/Modal.svelte:84](../apps/web/src/lib/components/Modal.svelte#L84)

Partiellement traité. La modale suit maintenant le shell (`layout.compact`),
donc un téléphone en paysage obtient le bottom sheet — scrollable, avec sa
poignée et son balayage — au lieu du dialogue centré qui coupait son propre
contenu ; et le dialogue desktop est passé de `max-h-[80vh] overflow-scroll`
à `max-h-[85svh] overflow-y-auto`, ce qui supprime la barre de défilement
horizontale parasite.

Ce qui reste : les boutons d'action arrivent en fin de contenu défilant, donc
sur « Créer une liste » à 430 px de haut, « Enregistrer » n'est pas visible à
l'ouverture (contenu 476 px pour 309 px utiles). Il faut faire défiler dans la
feuille pour valider.

**Remédiation recommandée** : ancrer les actions dans un pied fixe, ce qui
demande d'ajouter un snippet `actions` à `Modal` et de migrer les appelants
qui rendent aujourd'hui leurs boutons dans `children` :

```svelte
<div class="card flex max-h-[85svh] w-full flex-col overflow-hidden …">
  <header class="shrink-0 …">…</header>
  <div class="min-h-0 flex-1 overflow-y-auto …">{@render children()}</div>
  {#if actions}
    <footer class="border-border shrink-0 border-t …">{@render actions()}</footer>
  {/if}
</div>
```

Appelants à migrer : `ListFormModal`, `ReviewFormModal`, `EditProfileModal`,
`AddToListModal`, `ListMembersModal`, `CalendarSubscribeModal`,
`ReadingGoalEditModal`, `EditAvatarModal`, `ScanIsbnModal`,
`ScanProfileModal`. Le snippet restant optionnel, la migration peut se faire
modale par modale.

### M-11 · `100vh` au lieu de `svh` / `dvh`

La landing utilise déjà `min-h-[86svh]`
([routes/+page.svelte:415](../apps/web/src/routes/+page.svelte#L415)), mais
l'app reste sur des unités `vh`, qui incluent la barre d'URL mobile :

- `MobileLayout.svelte:16,19` — `min-h-screen` (deux fois) ;
- `DesktopSidebar.svelte:124` — `h-screen` ;
- `Modal.svelte:84` — `max-h-[80vh]` ;
- `Drawer.svelte:156` — `max-h-[88vh]` ;
- `Lightbox.svelte:127` — `max-h-[88vh]` ;
- `MermaidDiagram.svelte:131` — `h-[75vh]` ;
- `Dropdown.svelte:64` — `calc(100vh-2rem)`.

Effets : défilement résiduel permanent sur l'app même quand le contenu tient à
l'écran, et bas de modale/tiroir passant sous la barre d'outils du navigateur.

**Remédiation** : `min-h-[100svh]` pour les conteneurs de page, `dvh` pour les
surfaces qui doivent suivre l'apparition de la barre d'URL (tiroirs, modales,
lightbox). Prévoir un repli `vh` pour les navigateurs anciens via une
déclaration en cascade (`min-height: 100vh; min-height: 100svh;`).

---

### M-12 · La barre du bas ne tient pas ses 7 raccourcis sur écran étroit

**Fichiers** : `apps/web/src/routes/app/settings/components/AppearanceSection.svelte:32-33`
(`MIN = 3`, `MAX = 7`), `apps/web/src/lib/components/sidebars/BottomNavigation.svelte`

Avec 7 raccourcis configurés, chaque cellule tombe à 54 px à 375 px et à 45 px
à 320 px, pour des libellés de 10 px qui mesurent jusqu'à 52 px
(« Calendrier », « Recherche »). Les libellés se touchent puis se chevauchent :
ils ne sont pas tronqués, ils débordent sur la cellule voisine.

**Remédiation recommandée** : plafonner dynamiquement plutôt que d'imposer un
maximum fixe — 5 raccourcis en dessous de 360 px, 6 en dessous de 400 px,
7 au‑delà ; ou tronquer proprement le libellé (`truncate` + `px-0.5` sur la
cellule) et le masquer complètement sous 360 px en gardant l'icône et
l'`aria-label`. Signaler la limite dans l'écran de configuration plutôt que
d'accepter une configuration qui casse.

---

### M-13 · Couleur de barre système figée en sombre

**Fichiers** : [apps/web/src/app.html:8-13](../apps/web/src/app.html#L8),
[apps/web/src/lib/pwa-manifest.ts:12-13](../apps/web/src/lib/pwa-manifest.ts#L12)

Les balises `theme-color` sont conditionnées à `prefers-color-scheme`,
c'est‑à‑dire à la préférence **système**, alors que le thème de l'app se choisit
indépendamment dans les Paramètres (classe `dark` sur `<html>`). Un utilisateur
en thème clair sur un téléphone en mode sombre garde une barre d'état
`#0c0d10` au‑dessus d'une app `#f7f5f3`. Dans le manifest, `theme_color` et
`background_color` sont fixés en dur à `#0c0d10`, donc l'écran de démarrage de
la PWA est toujours sombre.

**Remédiation** : piloter la balise `theme-color` depuis le même code que le
thème applicatif (mise à jour de `<meta name="theme-color">` au changement de
thème), et retirer les deux variantes `media` qui deviennent inutiles.

---

### M-14 · `/app/admin/schema` fige le navigateur sur mobile

**Fichier** : `apps/web/src/lib/components/MermaidDiagram.svelte`

En portrait, la page ne rend jamais : le renderer cesse de répondre
(`get_page_text` et les captures expirent, le thread principal reste bloqué).
Le diagramme Mermaid du schéma complet est rendu de façon synchrone dans un
conteneur `h-[75vh]`.

**Remédiation recommandée** : vérifier d'abord si le blocage existe aussi sur
desktop — s'il est propre au mobile, c'est un problème de coût CPU. Dans les
deux cas, rendre le diagramme derrière un déclencheur explicite sous `md`
(« Afficher le diagramme ») plutôt qu'au montage, et afficher un état de
chargement pendant le rendu. La page est explicitement `devOnly`
(`ADMIN_NAV` filtre sur `appConfig.erdEnabled`), donc l'enjeu est faible, mais
un onglet figé est un mauvais signal.

---

### M-15 · Titres de page absents et titre rémanent

Toutes les pages sous `/app` renvoient `document.title === "Loomkeep"`. Pire,
le titre de la page précédente persiste après navigation : après l'onboarding,
`/app` affichait encore « Vérifiez votre email · Loomkeep » — le seul
`<svelte:head><title>` rencontré, posé par la page de vérification.

Ce n'est pas un défaut mobile à proprement parler, mais il se voit davantage
sur mobile : c'est le texte du sélecteur d'onglets, du partage système et de
l'historique.

**Remédiation** : ajouter un `<svelte:head><title>` par route (les libellés
existent déjà dans les catalogues Paraglide, réutiliser ceux de la navigation),
en suivant le format déjà employé : `{page} · Loomkeep`.

---

### M-16 · Une coupure réseau déconnecte l'utilisateur

Constaté pendant l'audit : quand l'API a été momentanément injoignable, l'app
a affiché « Impossible de contacter le serveur » sur `/login` après avoir
redirigé depuis `/app/feed` — la session n'était pas expirée, seul le réseau
manquait. Le pied de page affichait aussi « Loomkeep v » sans numéro et le
bouton « Créer un compte » avait disparu, `/api/config` n'ayant pas répondu.

Sur mobile (tunnel, ascenseur, bascule Wi‑Fi/4G), ce scénario est ordinaire et
éjecter l'utilisateur de sa session est disproportionné.

**Remédiation recommandée** : dans `bootstrap.svelte` / `app/+layout.svelte`,
distinguer « non authentifié » (401 explicite de l'API) de « API injoignable »
(erreur réseau, 5xx, timeout). Ne rediriger vers `/login` que dans le premier
cas ; dans le second, conserver la session en mémoire et afficher un bandeau
de reconnexion avec réessai. Vérifier au passage que
`errorCodeToMessageKey()` couvre bien un code de type `network.unreachable`
plutôt qu'un message générique.

---

### M-17 · Les bascules de domaine perdent les clics rapides

**Fichiers** : `apps/web/src/lib/components/onboarding/OnboardingWizard.svelte:70-75`,
`apps/web/src/routes/app/settings/components/DomainsSection.svelte`

`toggleDomain` calcule l'état suivant à partir de `auth.user.enabledDomains`
puis déclenche une mutation réseau ; il n'y a ni mise à jour optimiste, ni
état désactivé visible pendant le vol. Enchaîner quatre domaines plus vite que
l'aller‑retour serveur laisse une partie des clics sans effet (constaté à
l'étape 2 de l'onboarding : quatre tuiles cochées, un seul domaine enregistré).
Un humain sur un réseau mobile lent est exactement dans ce cas.

**Remédiation recommandée** : appliquer l'état localement à l'émission de la
mutation (mise à jour optimiste du cache TanStack, rollback sur erreur), ou à
défaut afficher un état « en cours » sur la tuile et empiler les changements
au lieu de repartir de l'état serveur à chaque clic. Le second point est le
plus important : la source de vérité du calcul doit être l'état _affiché_, pas
l'état serveur potentiellement en retard.

---

### M-18 · Incohérences de ton et de libellé

L'app tutoie (« Reprends là où tu t'es arrêté », « Trouve un titre et
ajoute‑le à ta bibliothèque »), mais trois écrans vouvoient :

- `/app/feed` — « Ce que font les membres que **vous** suivez », « Partagez
  votre profil pour que d'autres vous suivent » ;
- `/app/reviews` — « Toutes **vos** notes et critiques, à gérer d'un seul
  endroit » ;
- `/app/achievements` — « Découvrez tous les succès à débloquer et **suivez**
  votre progression ».

Par ailleurs `/app/reviews` s'intitule « Mes reviews » alors que le lien qui y
mène, sur l'accueil, dit « Mes critiques » — et le reste de l'app emploie
« critique » (`m.media_episode_review`, « Critiques de la communauté »).

**Remédiation** : reprendre ces clés dans
`apps/web/messages/{fr,en}/*.json` pour aligner sur le tutoiement, et
remplacer « Mes reviews » par « Mes critiques ». Un test de non‑régression
simple existe déjà dans le dépôt (`i18n.spec.ts`) et pourrait accueillir une
règle interdisant `vous`/`votre` dans le catalogue français.

---

### M-19 · Typographie sous le seuil de lisibilité

Relevé de tailles inférieures à 12 px sur du texte porteur d'information :

| Taille  | Exemple                                        | Écran       |
| ------- | ---------------------------------------------- | ----------- |
| 8,8 px  | badges `ADMIN`, `NON VÉRIFIÉ`, `PREMIUM`       | admin/users |
| 9,6 px  | « Notes via OMDb, sous licence CC BY-NC 4.0. » | fiche œuvre |
| 9,6 px  | « Voir sur TMDB · France »                     | fiche œuvre |
| 9,6 px  | `DERNIERS DÉBLOCAGES`, `DÉBLOQUÉ`              | succès      |
| 9,6 px  | badges `BÊTA`, `NOUVEAU`                       | global      |
| 10,4 px | noms de rôles du casting                       | fiche œuvre |
| 10,5 px | en‑têtes du tableau de rétention               | admin/stats |

Les badges purement décoratifs peuvent rester petits ; les libellés
informatifs (rôles du casting, en‑têtes de tableau, statuts de compte)
devraient remonter à 11–12 px minimum sous `sm`.

**Remédiation** : introduire un plancher dans le design system plutôt que de
corriger au cas par cas — par exemple une classe `.text-micro` documentée dans
`DESIGN.md` avec une valeur `clamp()` qui ne descend pas sous 11 px sur les
petits écrans, et réserver le 9,6 px aux pastilles non essentielles.

---

### M-20 · Accessibilité : états et noms manquants

- Les tuiles de domaine (onboarding et paramètres) sont des `<button>` sans
  `aria-pressed` : un lecteur d'écran n'annonce pas si le domaine est actif.
  L'état n'est porté que par les classes CSS.
- Les cases à cocher de l'inscription (CGU, âge minimum) n'ont pas de nom
  accessible — l'arbre d'accessibilité les expose en `checkbox "true"` sans
  libellé, alors que le texte est à côté d'elles.
- Le bloc `#svelte-announcer` est correctement en place, rien à signaler de ce
  côté.

**Remédiation** : ajouter `aria-pressed={on}` sur les tuiles de domaine, et
relier les cases à cocher à leur texte (`<label for>` ou englobement dans un
`<label>`) dans `routes/(auth)/register/+page.svelte`.

---

## Priorité 3 — polish

### M-21 · Retour mal aligné sur les titres à deux lignes

Sur les sous‑pages dont le titre passe sur deux lignes en portrait
(« Appareils connectés », « Statistiques d'instance »), le chevron de retour
et l'icône restent centrés sur la première ligne. `PageHeader.svelte` gagnerait
un `items-start` avec un décalage vertical fixe plutôt qu'un `items-center`.

### M-22 · « Mes listes » et « Mes critiques » absents du menu mobile

`resolveMenuGroups` (`navigation.ts`) ne référence ni `/app/lists` ni
`/app/reviews` : ces deux écrans ne sont atteignables que par la carte de
raccourcis de l'accueil. Le MenuSheet se présente pourtant comme « la
contrepartie mobile du rail desktop ». Les ajouter au groupe « Suivi ».

### M-23 · Landing : 6 329 px de hauteur en portrait, typographie du hero non adaptée au paysage

En portrait, la page d'accueil publique fait 6 329 px sur un viewport de
812 px, soit près de huit écrans, dont 2 038 px pour la seule section
« Au programme » (six domaines empilés en colonne unique). En paysage, le
titre du hero est dimensionné sur la largeur du viewport : à 812 px de large
pour 375 px de haut, « Tout ce que tu as joué. » occupe à lui seul tout
l'écran et les CTA passent sous la ligne de flottaison.

**Remédiation recommandée** :

- section « Au programme » : passer en grille 2 colonnes dès 375 px pour les
  six cartes de domaine (elles sont courtes), ce qui divise la section par
  deux ;
- hero : borner la typographie sur la hauteur autant que sur la largeur —
  `clamp()` avec une composante `svh`, ou une règle
  `@media (max-height: 500px)` qui réduit d'un cran l'échelle du titre et
  resserre le `py-20` ;
- envisager de replier les sections de comparaison derrière un « Voir le
  détail » sous `sm`, le motif existe déjà sur la page.

### M-24 · Écrans vides trop hauts, contenu premium flouté trop long

`/app` affiche des blocs vides pleine largeur (« Rien en cours de partie »,
« Rien en cours de lecture ») pour chaque domaine activé : 1 739 px de page
pour aucune donnée. `/app/stats` fait 7 470 px en portrait, dont une grande
part de cartes premium floutées que l'utilisateur doit traverser au
défilement.

**Remédiation** : sur mobile, replier les domaines sans activité en une seule
ligne cliquable plutôt qu'en carte pleine hauteur ; et regrouper les blocs
premium sous un seul teaser dépliable au lieu de les intercaler.

### M-25 · Flash de configuration au chargement

Avant la réponse de `/api/config`, le pied de page affiche « Loomkeep v » sans
numéro de version, et l'en‑tête de la landing s'affiche sans le bouton
« Se connecter » / « Créer un compte » (dépendants de `REGISTRATION_ENABLED`,
qui transite par `/api/config`). Réserver la place et n'afficher le libellé
qu'une fois la valeur connue, ou servir la version au build plutôt qu'à
l'exécution.

### M-26 · Donnée aberrante sur `/app/admin/signalements`

« Délai médian : **-1292.3h** ». Valeur négative, hors sujet mobile mais
relevée au passage — le calcul du délai de traitement doit prendre une valeur
absolue ou filtrer les signalements résolus avant leur création (données de
seed incohérentes ?).

---

## Récapitulatif

M-01 à M-06, M-08 et M-10 sont corrigés sur la branche
`fix/mobile-audit-p0-p1` et retirés de ce document. M-07 est partiellement
corrigé et requalifié P2 ; son périmètre restant est décrit ci-dessus.

| ID   | Priorité | Sujet                                                 | Portée           |
| ---- | -------- | ----------------------------------------------------- | ---------------- |
| M-07 | P2       | Actions de modale non ancrées                         | paysage          |
| M-09 | P1       | Cibles tactiles < 44 px                               | portrait+paysage |
| M-11 | P2       | `vh` au lieu de `svh`/`dvh`                           | portrait+paysage |
| M-12 | P2       | 7 raccourcis dans la barre du bas                     | portrait étroit  |
| M-13 | P2       | `theme-color` figée                                   | PWA              |
| M-14 | P2       | `/app/admin/schema` fige le navigateur                | portrait         |
| M-15 | P2       | Titres de page absents / rémanents                    | global           |
| M-16 | P2       | Coupure réseau = déconnexion                          | mobile surtout   |
| M-17 | P2       | Bascules de domaine : clics perdus                    | mobile surtout   |
| M-18 | P2       | Tutoiement / vouvoiement, « Mes reviews »             | global           |
| M-19 | P2       | Typographie sous 12 px                                | portrait         |
| M-20 | P2       | `aria-pressed`, libellés de cases à cocher            | global           |
| M-21 | P3       | Alignement du retour sur titre à deux lignes          | portrait         |
| M-22 | P3       | Listes / critiques absentes du menu mobile            | portrait         |
| M-23 | P3       | Landing trop longue, hero non adapté au paysage       | portrait+paysage |
| M-24 | P3       | Écrans vides trop hauts, premium flouté long          | portrait         |
| M-25 | P3       | Flash de configuration                                | global           |
| M-26 | P3       | Délai médian négatif                                  | admin            |
| M-27 | **P0**   | Un domaine premium actif vide toute la page d'accueil | global           |
| M-28 | P3       | Le widget Quackback recouvre la barre du bas          | portrait+paysage |

### Ordre de traitement suggéré

1. **M-27** en premier : c'est un écran d'accueil entièrement vide, et il ne
   demande qu'un correctif localisé.
2. **M-09** et **M-11** : deux passes transverses sur le design system, à
   faire en une fois plutôt que fichier par fichier.
3. **M-15**, **M-16**, **M-17**, **M-18** : quatre correctifs indépendants,
   sans dépendance entre eux.
4. Le reste au fil de l'eau. **M-07** peut attendre : le bottom sheet rend la
   situation acceptable en paysage.

### Constats découverts pendant la correction

#### M-27 · Un domaine premium resté actif vide entièrement la page d'accueil — **P0**

**Fichiers** : [apps/api/src/users/domain-gate.service.ts:43](../apps/api/src/users/domain-gate.service.ts#L43),
`apps/web/src/routes/app/+page.svelte`

`DomainGateService.getEnabledDomains()` retire les domaines de
`PREMIUM_DOMAINS` pour un compte non premium, mais `GET /users/me` renvoie
`enabledDomains` **brut**. Le front croit donc le domaine actif, monte sa
section d'accueil, et l'appel correspondant répond
`403 user.domain_disabled`.

Conséquence observée avec `enabledDomains = [MEDIA, GAMES, BOOKS, MUSIC]` sur
un compte non premium : `/app` ne rend **plus aucune section** — les huit
`<section>` existent mais sont vides, y compris la carte de raccourcis qui
n'utilise aucune requête. Retirer `MUSIC` de `enabledDomains` rétablit
immédiatement la page (0 lien de contenu → 25). Ce n'est donc pas une section
en erreur, c'est l'accueil entier qui disparaît.

Le scénario est explicitement anticipé côté API — le commentaire du service
mentionne « e.g. from before it became premium-gated » — mais le front ne le
gère pas.

**Remédiation recommandée** : deux correctifs, le second étant le plus
important.

1. Faire renvoyer par `GET /users/me` les domaines **effectifs** (ceux que
   `getEnabledDomains()` calcule), pour que nav, accueil et requêtes voient la
   même vérité. Attention à `PATCH /users/me`, qui doit continuer à accepter
   et conserver le choix brut de l'utilisateur.
2. Isoler chaque bloc de l'accueil pour qu'un 403 sur un domaine n'emporte pas
   la page : la cause exacte de l'écran vide est à confirmer (une erreur non
   rattrapée pendant le rendu semble la plus probable), mais quelle qu'elle
   soit, une section en échec doit dégrader en état vide, pas faire disparaître
   ses voisines. Un test de rendu de `/app` avec un domaine premium actif et
   son endpoint en 403 verrouillerait le comportement.

#### M-28 · Le widget Quackback recouvre la barre du bas — P3

La bulle de feedback flottante (widget tiers, `.quackback-panel`) se place en
bas à droite et recouvre le dernier onglet de la barre de navigation —
« Alertes » depuis le correctif M-04, « Calendrier » avant. En paysage elle
mord aussi sur le contenu.

**Remédiation** : décaler le widget au-dessus de la barre via sa
configuration, ou le masquer sous `md` et ne l'exposer que par l'entrée
« Aide & Feedback » des Paramètres, qui existe déjà.

### Points non couverts par cet audit

- Contraste couleur systématique : quelques sondages ponctuels, pas de passe
  complète en thème clair et sombre.
- Comportement au clavier physique / lecteur d'écran réel (VoiceOver,
  TalkBack) : seul l'arbre d'accessibilité a été inspecté.
- Écrans admin non visités : `cache`, `backup`, `communications`,
  `newsletter`, `security`, `services`, `imports`.
- Domaines Jeux et Musique avec contenu réel : les fournisseurs IGDB et
  MusicBrainz ne renvoyaient rien sur l'environnement de développement, seuls
  les états vides ont pu être vus.
- Détail d'une liste (`/app/lists/[id]`) et d'un livre (`/app/books/[id]`).
- Parcours de réinitialisation de mot de passe et connexion par passkey.
