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

**État au 22 septembre 2026** — M-01 à M-06, M-08 et M-10 sont corrigés
(PR #209), puis M-15, M-16, M-21, M-23, M-24, M-25 et M-26 (PR #210), puis
M-11, M-12, M-13, M-17, M-18, M-20 et M-28 (PR #244), et enfin M-19 et M-27 ;
tous retirés de ce document. M-07 est partiellement corrigé (requalifié P2).
M-09 reste ouvert volontairement. M-14 et M-22 ont été retirés sans
correctif : la page Schéma n'est pas exposée en production, et « Mes listes »
/ « Mes critiques » sont volontairement accessibles depuis l'accueil et le
profil, en mobile comme en desktop. M-27, M-28 et M-29 ont été découverts
pendant la correction, et sont corrigés.

De M-13, seules les couleurs du manifest PWA restent en dur : le manifest est
servi par locale, sans rien savoir du thème choisi, donc les régler demande un
arbitrage.

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

## Récapitulatif

Ce qu'il reste ouvert après les quatre passes de correction. M-07 est
partiellement corrigé et requalifié P2 ; son périmètre restant est décrit
ci-dessus.

| ID   | Priorité | Sujet                         | Portée           |
| ---- | -------- | ----------------------------- | ---------------- |
| M-07 | P2       | Actions de modale non ancrées | paysage          |
| M-09 | P1       | Cibles tactiles < 44 px       | portrait+paysage |

M-09 est une passe transverse sur le design system, à faire en une fois
plutôt que fichier par fichier. M-07 peut attendre : le bottom sheet rend la
situation acceptable en paysage.

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
