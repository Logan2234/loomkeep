# Internationalisation : suivi et audit des catalogues

État observé le 31 août 2026, sur la branche `codex/fix-i18n-catalog-consistency`.

Ce document consigne le travail restant et l'audit initial, puis son traitement.
**Le nettoyage des catalogues et la migration des composants sont appliqués.**
Les sections 2 à 6 conservent l'inventaire initial et les anciennes clés pour
expliquer les décisions.

## État actuel du périmètre frontend

Les textes propres aux composants de `apps/web/src/lib/components` ont été
migrés : modales, import, recherche, bibliothèque, commentaires, critiques,
statistiques, infobulles, accessibilité et navigation des images.

- 242 clés FR/EN ajoutées, dont des clés génériques réutilisables ; les messages
  déjà disponibles ont été réutilisés plutôt que dupliqués.
- La passe suivante ajoute 15 clés pour les réponses d'import : 1 générique
  (`common_favorite`) et 14 métier. Les statuts, types de médias et erreurs
  réutilisent les traductions existantes.
- Dernière passe frontend : 45 clés supplémentaires (4 dans `common`, 41 dans
  `other`) pour les notifications et les libellés d'administration. Les derniers
  formats numériques, unités et replis d'affichage de langue sont corrigés.
- Les paramètres des phrases, compteurs, délais et formes singulier/pluriel sont
  localisés. Les nombres des composants de statistiques utilisent `formatNumber`
  et les jours de semaine utilisent le formatage de date avec la langue active.
- Les helpers `stats-domain.ts` et `possession-labels.ts` lisent les traductions
  à chaque accès, sans figer la langue au chargement du module.
- `settings_mfa_recovery_regenerate_action` a été promue en
  `common_regenerate` ; `media_status_watching` est devenue
  `library_status_in_progress`. Leurs consommateurs ont été mis à jour.
- Le contrôle parcourt les 106 composants Svelte : aucun texte statique
  utilisateur non migré n'y est détecté. Les initiales de marque et le marqueur
  de version sont explicitement exemptés.
- Les cinq groupes de textes identiques volontairement distincts de l'audit
  précédent restent les seules duplications bilingues de valeur repérées dans
  `common` et `other`. Les codes d'erreur de `errors` conservent leurs messages
  parfois identiques : ils correspondent à des erreurs API distinctes.

| Catalogue     | Clés par langue après migration |
| ------------- | ------------------------------: |
| `common.json` |                             250 |
| `other.json`  |                            1491 |
| `errors.json` |                             156 |

### Ce qu'il reste côté frontend

- Vérification visuelle FR/EN des parcours connectés : pas de recette complète
  dans un navigateur pendant cette passe. Le build local a été ouvert avec le
  navigateur intégré sur `/app/admin/services` ; redirection vers la connexion,
  faute de session administrateur. Une session locale est nécessaire pour finir
  cette recette, sans contourner l'authentification.
- Aucun autre libellé d'interface à migrer n'est identifié dans le périmètre
  inspecté. Ce constat n'est pas une garantie sur tous les futurs types de
  réponses API ; les contrôles automatiques ne remplacent pas la recette visuelle.

### Hors de ce ticket frontend

- Emails et push : génération backend, explicitement réservée à un autre ticket.
  Les libellés des contrôles de prévisualisation dans l'administration sont,
  eux, traduits ; les sujets, corps et valeurs d'exemple des emails sont préservés.
- Journaux d'administration : résumés d'exécution et diagnostics stockés par le
  serveur, conservés tels quels pour ne pas altérer l'historique technique. Leur
  éventuelle structuration/localisation relève du producteur backend.
- Titres d'œuvres et de listes, noms de personnes, extraits de commentaires,
  motifs rédigés par un modérateur et contenus éditoriaux externes : données
  originales, pas des messages d'interface à traduire automatiquement.
- Les erreurs techniques internes, comme `Canvas non supporté` ou
  `Turnstile script failed to load`, ne sont pas des libellés d'interface à
  remplacer par des clés de traduction.

Les sections suivantes conservent le détail historique de l'audit et du
nettoyage. Les exemples en dur de la section 1 décrivent l'état **avant** cette
migration, pas des tâches encore ouvertes.

## Résultat du nettoyage préalable

- 99 anciennes clés remplacées par leurs clés canoniques dans les catalogues FR/EN
  et leurs consommateurs. Les anciens identifiants ont été retirés.
- 37 nouvelles clés génériques dans `common` ; les concepts métier partagés
  restent dans `other`, sous des noms transversaux.
- 51 messages de moins par langue au total, sans supprimer de fonctionnalité.
- Plus aucun texte générique dupliqué entre `common` et `other`.
- Les 47 groupes identiques FR/EN de l'audit initial sont ramenés à **5 groupes
  volontairement distincts** : calendrier de développement podcasts/jeux de
  société, tarifs de concurrents, descriptifs des imports Goodreads/StoryGraph,
  collection éditoriale/type de liste, offre streaming/possession.
- `common_finish` utilise désormais « Terminer » en FR, distinct du statut
  `library_status_completed` (« Terminé »).
- « Se connecter » utilise `common_login` (« Log in » en EN). Les libellés courts
  « Bientôt », « Bientôt disponible » et « Disponible prochainement » sont
  harmonisés sous `common_coming_soon` (« Bientôt » / « Coming soon »).
- Les variantes nom/action (`admin_cache_sort` / `common_sort`) et les
  concepts activité/fil d'activité restent distincts.

| Catalogue     | Clés par langue après nettoyage |
| ------------- | ------------------------------: |
| `common.json` |                             208 |
| `other.json`  |                            1233 |
| `errors.json` |                             156 |

Le nettoyage préalable avait mis à jour les identifiants sans migrer les textes
en dur des composants. Ce second lot est maintenant traité, comme indiqué dans
l'état actuel ci-dessus.

Les noms isolés « titre/titres » sont maintenant mutualisés sous
`library_title_one` / `library_title_many` : le profil affiche le nombre et le nom
dans deux blocs visuels distincts, et les descripteurs d'import exposent encore
un contrat `noun.one/many`. La phrase « {noun} à importer » est désormais traduite sans
modifier cette présentation.
Le libellé autonome d'activité reste `common_active` ; les autres fragments déjà
traduits du profil conservent leur présentation existante.

Les anciennes clés retirées sont récupérables dans l'historique Git et visibles
dans le diff ; aucun fichier de traduction ni contenu utilisateur n'a été supprimé.

## 1. Périmètre déjà traité et reste à faire

Les passes précédentes ont porté sur les fichiers de `apps/web/src/routes`
(notamment les pages et composants locaux de `routes/app`), la racine de
`apps/web/src/lib`, `src/lib/constants`, et la PWA.

La langue de secours est maintenant l'anglais. La préférence explicite par cookie
prend le pas sur la langue du navigateur ; sans langue prise en charge, repli sur
`en`. Le manifeste et l'initialisation de la PWA ont été traités.

Les composants partagés ont maintenant été migrés. Les contenus reçus de l'API
et la recette visuelle complète restent hors de cette vérification des textes
propres au frontend.

### Prochains lots

- [x] Réorganiser les clés suivant les recommandations des sections 3 à 6, avant
      d'ajouter les messages des composants, pour favoriser la réutilisation.
- [x] Migrer les composants de listes, profil, avatar et formulaires de critique.
- [x] Migrer `ImportWizard.svelte`, y compris les erreurs locales, les états
      d'analyse/import, les compteurs et les confirmations d'écrasement.
- [x] Migrer `LibraryBrowser.svelte` et les quatre panneaux de recherche.
- [x] Migrer `CommentThread.svelte` et les mentions résiduelles des critiques.
- [x] Migrer `components/stats`, y compris les exemples affichés en aperçu,
      filtres, légendes, infobulles, unités et les deux fichiers TypeScript.
- [x] Migrer les derniers textes d'accessibilité, navigation des images,
      calendrier, activité et série de jours consécutifs.
- [x] Vérifier les chaînes calculées, les pluriels et les formats de date/nombre,
      pas seulement le texte statique des templates.
- [ ] Faire une vérification visuelle FR/EN des parcours après ces migrations.
- [ ] Auditer séparément les emails et notifications générés côté backend :
      leurs contenus ne sont pas couverts par la localisation du manifeste PWA.

Le dossier `src/lib/components` contient **106 fichiers Svelte et 2 fichiers
TypeScript**. Ce n'est pas un compte de fichiers tous à traduire : beaucoup
utilisent déjà Paraglide ou ne contiennent aucun texte destiné à l'utilisateur.

### Cas identifiés avant migration, désormais traités

Analyse des templates Svelte : texte visible et attributs destinés à l'utilisateur,
en excluant notamment les classes CSS, chemins et attributs techniques.
**34 fichiers Svelte** contenaient du texte statique à migrer. Les exemples
ci-dessous ne recensent pas toutes les occurrences ; les numéros de ligne sont
ceux de cet audit.

| Fichier sous `src/lib/components`                                                                         | Exemples encore en dur                                                                                                        |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [AddToListModal.svelte](../apps/web/src/lib/components/AddToListModal.svelte)                             | « Ajouter à une liste » (ligne 79) ; « Tu n'as pas encore de liste. » (ligne 85)                                              |
| [AvatarLightbox.svelte](../apps/web/src/lib/components/AvatarLightbox.svelte)                             | « Avatar en grand » (ligne 22) ; « Réduire l'avatar » (ligne 41)                                                              |
| [CalendarSubscribeModal.svelte](../apps/web/src/lib/components/CalendarSubscribeModal.svelte)             | « Ajouter à mon agenda » (ligne 51) ; « Génération du lien… » (ligne 53)                                                      |
| [CommentThread.svelte](../apps/web/src/lib/components/CommentThread.svelte)                               | « Réagir » (ligne 337) ; « Réagir » (ligne 338)                                                                               |
| [EditAvatarModal.svelte](../apps/web/src/lib/components/EditAvatarModal.svelte)                           | « Photo de profil » (ligne 177) ; « Faites glisser l'image pour choisir le cadrage. » (ligne 198)                             |
| [EditProfileModal.svelte](../apps/web/src/lib/components/EditProfileModal.svelte)                         | « Modifier le profil » (ligne 40) ; « Nom affiché » (ligne 43)                                                                |
| [FocusOverlay.svelte](../apps/web/src/lib/components/FocusOverlay.svelte)                                 | « Actions » (ligne 52)                                                                                                        |
| [ImportWizard.svelte](../apps/web/src/lib/components/ImportWizard.svelte)                                 | « Import » (ligne 419) ; « clique ou dépose pour changer » (ligne 457)                                                        |
| [LegalLinks.svelte](../apps/web/src/lib/components/LegalLinks.svelte)                                     | « Informations légales » (ligne 12)                                                                                           |
| [LibraryBrowser.svelte](../apps/web/src/lib/components/LibraryBrowser.svelte)                             | « Filtrer ma bibliothèque… » (ligne 243) ; « Type » (ligne 258)                                                               |
| [Lightbox.svelte](../apps/web/src/lib/components/Lightbox.svelte)                                         | « Image précédente » (ligne 90) ; « Image suivante » (ligne 97)                                                               |
| [ListFormModal.svelte](../apps/web/src/lib/components/ListFormModal.svelte)                               | « Mon top 10… » (ligne 95) ; « · optionnel » (ligne 103)                                                                      |
| [ProfileActivity.svelte](../apps/web/src/lib/components/ProfileActivity.svelte)                           | « Activité récente » (ligne 29)                                                                                               |
| [RatingPips.svelte](../apps/web/src/lib/components/RatingPips.svelte)                                     | « Ma note » (ligne 41) ; « Note sur 10 » (ligne 43)                                                                           |
| [ReviewFormModal.svelte](../apps/web/src/lib/components/ReviewFormModal.svelte)                           | « Critique · optionnel » (ligne 108) ; « Votre avis… » (ligne 114)                                                            |
| [ReviewsSection.svelte](../apps/web/src/lib/components/ReviewsSection.svelte)                             | « Utilisateur supprimé » (ligne 214)                                                                                          |
| [StreakBadge.svelte](../apps/web/src/lib/components/StreakBadge.svelte)                                   | « prise » (ligne 14) ; « d'affilée — jours de suite avec un épisode ou un film vu » (ligne 16)                                |
| [TrendChart.svelte](../apps/web/src/lib/components/TrendChart.svelte)                                     | « Évolution sur la période sélectionnée » (ligne 88)                                                                          |
| [search/BookSearchPanel.svelte](../apps/web/src/lib/components/search/BookSearchPanel.svelte)             | « Par auteur » (ligne 111) ; « Aucun livre trouvé. » (ligne 176)                                                              |
| [search/GameSearchPanel.svelte](../apps/web/src/lib/components/search/GameSearchPanel.svelte)             | « Jeu » (ligne 128) ; « Aucun jeu trouvé. » (ligne 155)                                                                       |
| [search/MediaSearchPanel.svelte](../apps/web/src/lib/components/search/MediaSearchPanel.svelte)           | « Lance une recherche pour trouver un film, une série ou un animé. » (ligne 267)                                              |
| [search/MusicSearchPanel.svelte](../apps/web/src/lib/components/search/MusicSearchPanel.svelte)           | « Album » (ligne 134) ; « Aucun album trouvé. » (ligne 161)                                                                   |
| [stats/BookStatsSection.svelte](../apps/web/src/lib/components/stats/BookStatsSection.svelte)             | « Pages lues » (ligne 70) ; « Lus » (ligne 73)                                                                                |
| [stats/CalendarHeatmap.svelte](../apps/web/src/lib/components/stats/CalendarHeatmap.svelte)               | « Heatmap d'activité » (ligne 62)                                                                                             |
| [stats/GameStatsSection.svelte](../apps/web/src/lib/components/stats/GameStatsSection.svelte)             | « Temps de jeu » (ligne 125) ; « Terminés » (ligne 129)                                                                       |
| [stats/HistogramBars.svelte](../apps/web/src/lib/components/stats/HistogramBars.svelte)                   | « Histogramme » (ligne 39)                                                                                                    |
| [stats/InsufficientDataNotice.svelte](../apps/web/src/lib/components/stats/InsufficientDataNotice.svelte) | « Pas assez de données » (ligne 18) ; « % renseigné pour l'instant.) » (ligne 22)                                             |
| [stats/LineChart.svelte](../apps/web/src/lib/components/stats/LineChart.svelte)                           | « Courbe » (ligne 49)                                                                                                         |
| [stats/MusicStatsSection.svelte](../apps/web/src/lib/components/stats/MusicStatsSection.svelte)           | « Durée d'écoute » (ligne 78) ; « Écoutés » (ligne 79)                                                                        |
| [stats/RankBars.svelte](../apps/web/src/lib/components/stats/RankBars.svelte)                             | « Rien pour l'instant. » (ligne 34)                                                                                           |
| [stats/SocialStatsSection.svelte](../apps/web/src/lib/components/stats/SocialStatsSection.svelte)         | « Critiques écrites » (ligne 89) ; « Commentaires » (ligne 95)                                                                |
| [stats/StatsWorksModal.svelte](../apps/web/src/lib/components/stats/StatsWorksModal.svelte)               | « Rien pour l'instant. » (ligne 39)                                                                                           |
| [stats/VideoStatsSection.svelte](../apps/web/src/lib/components/stats/VideoStatsSection.svelte)           | « Temps de visionnage » (ligne 129) ; « Épisodes vus » (ligne 131)                                                            |
| [stats/VideoTemporalSection.svelte](../apps/web/src/lib/components/stats/VideoTemporalSection.svelte)     | « Épisodes & films vus par jour » (ligne 103) ; « Historique réel (import TV Time inclus) — 365 derniers jours. » (ligne 106) |

Autres cas confirmés que le seul repérage de texte statique ne suffit pas à voir :

| Fichier                                                                                 | Travail restant                                                                                                                              |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [Carousel.svelte](../apps/web/src/lib/components/Carousel.svelte)                       | Libellé calculé `Aller à la page ${i + 1}` (ligne 198).                                                                                      |
| [stats/PeriodFilter.svelte](../apps/web/src/lib/components/stats/PeriodFilter.svelte)   | « Tout l'historique », suffixes des 365/30/7 derniers jours (lignes 21–24).                                                                  |
| [stats/stats-domain.ts](../apps/web/src/lib/components/stats/stats-domain.ts)           | Statuts « À faire », « En cours », « Terminé », « Abandonné ». Réutiliser les clés métier partagées ; conserver les identifiants techniques. |
| [stats/possession-labels.ts](../apps/web/src/lib/components/stats/possession-labels.ts) | Libellés de possession. Réutiliser les clés `ownership_*` existantes.                                                                        |

L'audit initial identifiait donc **au moins 36 composants Svelte et 2 fichiers
TypeScript avec des cas confirmés**. Ces cas sont maintenant traités.
Dans les fichiers déjà listés, vérifier également les chaînes des scripts et des
expressions : par exemple les erreurs de `ImportWizard`, les catégories de
`MediaSearchPanel`, les pluriels de `AddToListModal` et les libellés conditionnels
de `CommentThread`.

Ne pas traduire les identifiants d'API, valeurs d'enum, noms de fournisseurs,
codes de langue, contenus saisis par les utilisateurs ou œuvres provenant du
catalogue. Les messages techniques de logs ne deviennent pas automatiquement des
messages d'interface.

## 2. État structurel initial des catalogues

Les fichiers réels sont `apps/web/messages/{fr,en}/common.json`,
`other.json` (sans « s ») et `errors.json`.

| Catalogue     | Clés FR, hors `$schema` | Clés EN, hors `$schema` |
| ------------- | ----------------------: | ----------------------: |
| `common.json` |                     171 |                     171 |
| `other.json`  |                    1321 |                    1321 |
| `errors.json` |                     156 |                     156 |

Contrôles effectués sur les six fichiers :

- Aucune clé JSON déclarée deux fois dans un même fichier.
- Aucune collision d'identifiant entre catalogues d'une même langue.
- Aucune clé absente d'un côté FR/EN.
- Les paramètres interpolés `{name}`, `{count}`, etc. correspondent entre FR et EN.

En revanche, `common` et `other` contiennent **47 groupes de textes strictement
identiques dans les deux langues**, soit 101 clés concernées et 54 occurrences
supplémentaires au-delà d'une clé par groupe. **Ce ne sont pas 54 clés à supprimer
automatiquement** : plusieurs groupes représentent des concepts indépendants.
Il n'y a pas de doublon de valeur FR/EN strict à l'intérieur de `common` seul.

Méthode : comparaison des identifiants dans le JSON brut avant parsing, puis des
clés et paramètres après parsing ; regroupement des valeurs par couple exact
`(fr, en)`, et examen complémentaire des mêmes textes français ayant des
traductions anglaises différentes. Le regroupement des valeurs porte sur
`common` et `other`, pas sur les messages d'erreur API.

## 3. Règle de classement recommandée

### `common.json` : vocabulaire transversal de l'interface

Une clé y a sa place quand sa signification est indépendante d'une page ou d'un
parcours : actions, champs usuels, navigation, unités, noms de rubriques partagées.

Les clés actuelles y sont globalement à leur place. Les noms de domaines
(`common_Books`, `common_Music`, etc.) constituent le vocabulaire commun de
Loomkeep. Les champs de compte et de mot de passe sont réutilisables, même si leur
première utilisation vient de l'authentification.

`common_resend_cooldown` est à la frontière : il est actuellement partagé entre
connexion MFA, vérification après inscription et réglages de sécurité. Le garder
dans `common` est cohérent comme état générique d'un bouton « Renvoyer » ;
le déplacer n'est pas une priorité.

Conserver les variantes qui ont un sens réel : `common_today_short` donne
« Auj. », contrairement à `common_today` ; les pluriels et les variantes de
marque ne sont pas des doublons techniques. La casse seule ne doit toutefois pas
servir de convention générale pour créer de nouvelles clés.

Point éditorial repéré : `common_finish` vaut « Terminé » en FR mais « Finish »
en EN et sert au bouton final de `Wizard.svelte`. Pour une action, « Terminer »
serait plus cohérent ; **ne pas la réutiliser pour le statut « Completed »**.

### `other.json` : messages contextuels, y compris les messages métier partagés

Un message partagé entre deux écrans peut rester dans `other` si sa signification
appartient à un même domaine : `ownership_*`, `library_status_*`, `auth_mfa_*`,
`report_*`, etc. « Réutilisable » ne signifie pas systématiquement « common ».

Y conserver les consignes d'import propres à une source, confirmations précises,
phrases de profil, descriptions de statut, copies marketing, mentions fournisseur
et textes de modération. Éviter les noms liés à une page quand le concept est déjà
partagé : préférer `ownership_borrowed` à une deuxième clé
`stats_ownership_borrowed`.

### `errors.json` : contrat des erreurs API et validations

Ce catalogue contient notamment les clés `apierr_*` utilisées par
`src/lib/api/errors.ts` et les validations. Un titre de page d'erreur ou un
diagnostic purement local peut rester dans `other` : ne pas déplacer toutes les
phrases contenant « erreur » dans `errors`. Pour les erreurs API, continuer à
utiliser `resolveApiError`, pas le texte technique de `err.message`.

## 4. Priorités : réutiliser `common` et y promouvoir les vrais génériques

Réutilisations directes, sans changement de traduction :

| Clés de `other`                                    | Clé existante à utiliser |
| -------------------------------------------------- | ------------------------ |
| `book_language`                                    | `common_language`        |
| `profile_reviews_public`                           | `common_public`          |
| `settings_section_import`, `settings_import_title` | `common_import`          |
| `terms_reacceptance_action_loading`                | `common_save_loading`    |

Autres libellés génériques à promouvoir. Les nouveaux identifiants ci-dessous sont
des **propositions**, pas des clés déjà créées ; mettre à jour FR, EN et les usages
ensemble.

| Clés actuelles                                                | Cible recommandée                        | Pourquoi                                                                                                                |
| ------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `music_links`                                                 | `common_links`                           | « Liens » est déjà utilisé pour la musique et la vidéo.                                                                 |
| `ownership_detail_label`                                      | `common_detail`                          | « Détail » est aussi utilisé par l'administration du cache ; ne pas remplacer par « Détails » sans décision éditoriale. |
| `profile_lists_title`                                         | `common_lists`                           | Nom générique de rubrique, également utilisé dans l'administration.                                                     |
| `profile_lists_view_all`                                      | `common_view_all`                        | Action « Tout voir », différente de « Voir plus ».                                                                      |
| `share_profile_copy_link`, `share_profile_copied`             | `common_copy_link`, `common_link_copied` | Le calendrier a déjà les mêmes textes en dur.                                                                           |
| `settings_privacy_learn_more`                                 | `common_learn_more`                      | Action de navigation non spécifique à la confidentialité.                                                               |
| `lists_kind_label`                                            | `common_type`                            | Champ « Type », déjà présent en dur dans plusieurs composants.                                                          |
| `lists_visibility`                                            | `common_visibility`                      | Visibilité générique, réutilisable pour listes et critiques.                                                            |
| `settings_category`, `settings_action`                        | `common_category`, `common_action`       | Noms de champs ; ne pas déplacer les descriptions de catégories de modération.                                          |
| `media_more_actions`                                          | `common_more_actions`                    | Menu d'actions générique ; garder les variantes « pour la saison » spécifiques.                                         |
| `landing_salle_music_label`                                   | `common_albums`                          | « Albums » est réutilisé hors landing, notamment dans les statistiques d'un compte.                                     |
| `admin_catalogue_table_domain`, `admin_catalogue_table_items` | `common_domain`, `common_items`          | Noms usuels du vocabulaire de l'application.                                                                            |
| `stats_works_label`                                           | `common_works`                           | Pluriel de `common_work`, réutilisable sans référence aux statistiques.                                                 |
| `settings_birthdate_label`                                    | `common_birthdate`                       | Champ de profil/compte générique.                                                                                       |
| `admin_backup_size`                                           | `common_size`                            | Libellé « Taille », indépendant de la sauvegarde.                                                                       |
| `admin_users_title`                                           | `common_users`                           | Nom générique de rubrique ; garder les confirmations d'administration contextuelles.                                    |

Les candidats génériques déjà dupliqués (« Thème », « Fuseau horaire »,
« Notifications », « Commentaires », « Social », « Domaines », etc.) figurent dans
le tableau exhaustif de la section suivante.

Harmonisations proches, mais pas identiques, à décider explicitement :

- `settings_export_csv_coming_soon_hint` (« Disponible prochainement ») est aussi
  utilisé dans le cache admin. `search_coming_soon` (« Bientôt disponible ») et
  `common_coming_soon` (« Bientôt ») désignent le même état. Choisir une formulation
  commune si l'on accepte ce changement éditorial ; garder la phrase complète
  `home_coming_soon` contextualisée.
- `auth_login_action` et `landing_login` ont le même FR « Se connecter », mais
  « Log in » / « Sign in » en EN : candidat à une action `common_login` après
  harmonisation, pas doublon bilingue exact.
- `admin_cache_sort` (« Tri ») n'est pas textuellement identique à
  `common_sort` (« Trier »). Distinguer nom de champ et action.
- `common_activity` et `nav_feed` ont le même FR mais « Activity » / « Feed » en
  EN. Distinguer activité générique et fil d'activité.

## 5. Inventaire initial des 47 groupes identiques FR/EN

Les recommandations portent sur le **sens**, pas uniquement sur l'égalité des
chaînes. Certaines lignes recommandent donc de conserver plusieurs clés.

| Nº  | Texte FR                                                                                                | Clés actuelles                                                                                                             | Recommandation                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Enregistrement…                                                                                         | `common_save_loading`, `terms_reacceptance_action_loading`                                                                 | Remplacer `terms_reacceptance_action_loading` par `common_save_loading`.                                                                                        |
| 2   | Public                                                                                                  | `common_public`, `profile_reviews_public`                                                                                  | Réutiliser `common_public` pour le libellé de visibilité.                                                                                                       |
| 3   | Langue                                                                                                  | `common_language`, `book_language`                                                                                         | Remplacer `book_language` par `common_language`.                                                                                                                |
| 4   | Import                                                                                                  | `common_import`, `settings_section_import`, `settings_import_title`                                                        | Réutiliser `common_import` dans les deux titres de réglages.                                                                                                    |
| 5   | Social                                                                                                  | `admin_stats_section_social`, `stats_social`                                                                               | Créer `common_social` pour le nom de cette rubrique transversale.                                                                                               |
| 6   | Commentaires                                                                                            | `admin_social_total_comments`, `settings_delete_account_comments`                                                          | Créer `common_comments` pour le nom générique ; conserver des clés propres aux phrases et aux compteurs.                                                        |
| 7   | En attente                                                                                              | `admin_social_reports_pending`, `report_status_pending`                                                                    | Réutiliser `report_status_pending` dans les indicateurs de signalements ; ce statut métier reste dans `other`.                                                  |
| 8   | aucune                                                                                                  | `admin_system_no_backup`, `admin_no_backups`                                                                               | Garder une seule clé de sauvegarde, par exemple `admin_no_backups` ; « aucune » ne remplace pas le « Aucun » générique dans tous les contextes.                 |
| 9   | Retour à l'accueil                                                                                      | `profile_not_found_back_home`, `error_generic_cta_home`                                                                    | Créer `common_back_home` pour cette action de navigation identique.                                                                                             |
| 10  | titres                                                                                                  | `profile_titles_plural`, `import_title_many`                                                                               | Éviter deux familles de fragments identiques ; préférer des messages complets avec `{count}` aux concaténations. Ne pas confondre avec le champ `common_title`. |
| 11  | titre                                                                                                   | `profile_titles_singular`, `import_title_one`                                                                              | Même recommandation que pour le pluriel : mutualiser les compteurs, pas tous les sens du mot « titre ».                                                         |
| 12  | Actif                                                                                                   | `profile_activity_summary_prefix`, `settings_sessions_active_prefix`                                                       | Créer `common_active` si le libellé reste autonome ; conserver des messages complets pour « actif le… » / « actif ces… ».                                       |
| 13  | Application d'authentification                                                                          | `auth_mfa_choose_method_totp_label`, `settings_mfa_totp_label`                                                             | Mutualiser sous une clé `auth_mfa_*` utilisée par la connexion et les réglages ; reste dans `other`.                                                            |
| 14  | Code par email                                                                                          | `auth_mfa_choose_method_email_label`, `settings_mfa_email_label`                                                           | Mutualiser sous une clé `auth_mfa_*` utilisée par la connexion et les réglages ; reste dans `other`.                                                            |
| 15  | Mot de passe actuel                                                                                     | `settings_mfa_totp_disable_password_label`, `settings_current_password_label`                                              | Créer `common_current_password`, cohérent avec les champs de mot de passe déjà dans `common`.                                                                   |
| 16  | Domaines                                                                                                | `settings_section_domains`, `onboarding_step_domains`, `settings_domains_title`                                            | Créer `common_domains` pour la taxonomie commune de l'application.                                                                                              |
| 17  | Fuseau horaire                                                                                          | `settings_communications_timezone_label`, `onboarding_settings_timezone_label`                                             | Créer `common_timezone` pour le champ de fuseau horaire.                                                                                                        |
| 18  | Notifications push                                                                                      | `settings_communications_push_label`, `onboarding_settings_push_label`                                                     | Créer `common_push_notifications` pour le libellé, sans y déplacer les explications du parcours.                                                                |
| 19  | Non disponible sur cet appareil ou ce navigateur.                                                       | `settings_communications_push_unsupported`, `onboarding_settings_push_unsupported`                                         | Mutualiser sous une clé contextuelle `notifications_push_unsupported` dans `other`.                                                                             |
| 20  | Notifications refusées ou indisponibles sur cet appareil.                                               | `settings_communications_push_error`, `onboarding_settings_push_error`                                                     | Mutualiser sous une clé contextuelle `notifications_push_error` dans `other`.                                                                                   |
| 21  | Newsletter                                                                                              | `settings_communications_newsletter_label`, `onboarding_settings_newsletter_label`                                         | Créer `common_newsletter` pour ce libellé.                                                                                                                      |
| 22  | Apparence                                                                                               | `settings_section_appearance`, `settings_appearance_title`                                                                 | Une seule clé `settings_appearance_title` suffit pour le menu et la section ; promotion dans `common` seulement si le sens doit être transversal.               |
| 23  | Zone de danger                                                                                          | `settings_section_danger_zone`, `settings_danger_zone_title`                                                               | Une seule clé `settings_danger_zone_title` suffit ; garder ce bloc de réglages dans `other`.                                                                    |
| 24  | Proposer une idée                                                                                       | `settings_help_feature_request`, `landing_footer_link_suggest`                                                             | Créer `common_suggest_idea` pour l'action partagée.                                                                                                             |
| 25  | Signaler un bug                                                                                         | `settings_help_bug_report`, `landing_footer_link_bug`                                                                      | Créer `common_report_bug` pour l'action partagée.                                                                                                               |
| 26  | This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB. | `settings_datasources_tmdb_notice`, `media_tmdb_notice`                                                                    | Mutualiser la même attribution sous une clé de fournisseur dans `other` ; ne pas la traiter comme un libellé UI générique.                                      |
| 27  | Vue d'ensemble                                                                                          | `nav_overview`, `stats_overview_label`                                                                                     | Créer `common_overview` pour ce libellé de navigation.                                                                                                          |
| 28  | Lien invalide : aucun token trouvé dans l'URL.                                                          | `auth_reset_password_invalid_link`, `auth_verify_email_invalid_link`, `newsletter_unsubscribe_invalid_link`                | Mutualiser le diagnostic de lien sous une clé contextuelle dans `other`. Ce n'est pas un code d'erreur API ; ne pas le déplacer mécaniquement dans `errors`.    |
| 29  | Notifications                                                                                           | `notif_title`, `settings_delete_account_notifications`                                                                     | Créer `common_notifications` pour le nom de la rubrique.                                                                                                        |
| 30  | Collaborateurs                                                                                          | `list_members_manage`, `list_members_title`                                                                                | Une seule clé `list_members_title` suffit pour le bouton et le titre ; garder le contexte des listes dans `other`.                                              |
| 31  | Annoncé dans les réglages, pas encore développé.                                                        | `landing_salle_podcasts_detail`, `landing_salle_boardgames_detail`                                                         | Conserver les clés indépendantes : l'état de développement des podcasts et des jeux de société peut diverger.                                                   |
| 32  | gratuit                                                                                                 | `landing_rival_hltb_price`, `landing_rival_goodreads_price`, `landing_rival_bookwyrm_price`, `landing_rival_discogs_price` | Conserver les clés propres aux concurrents : leurs tarifs peuvent évoluer indépendamment.                                                                       |
| 33  | Lectures, dates et notes (CSV)                                                                          | `landing_import_done_goodreads_what`, `landing_import_done_storygraph_what`                                                | Conserver les clés propres aux imports : les champs pris en charge peuvent diverger selon la source.                                                            |
| 34  | Voir le code                                                                                            | `landing_name_cta`, `landing_final_cta_secondary`                                                                          | Réutiliser une seule clé de CTA dans `other` (lien vers le dépôt) ; pas besoin de rendre toute copie marketing générique.                                       |
| 35  | Thème                                                                                                   | `onboarding_settings_theme`, `settings_theme_label`                                                                        | Créer `common_theme`, cohérent avec `common_theme_light` et `common_theme_dark`.                                                                                |
| 36  | Appareils connectés                                                                                     | `settings_connected_devices`, `settings_sessions_title`                                                                    | Conserver une seule clé `settings_sessions_title`, contexte des sessions.                                                                                       |
| 37  | Fil d'activité                                                                                          | `settings_delete_account_activity`, `home_sidebar_activity_feed`, `feed_title`                                             | Créer `common_activity_feed`, distinct de `common_activity`.                                                                                                    |
| 38  | Déconnecter                                                                                             | `settings_sessions_disconnect_button`, `settings_sessions_disconnect_confirm`                                              | Une seule clé d'action pour les sessions ; ne pas la confondre avec `common_logout` (se déconnecter soi-même).                                                  |
| 39  | Mes listes                                                                                              | `home_sidebar_my_lists`, `lists_title`                                                                                     | Réutiliser `lists_title` pour le raccourci et le titre ; garder le possessif/contextuel dans `other`.                                                           |
| 40  | Collection                                                                                              | `lists_kind_collection`, `book_collection`                                                                                 | Conserver séparément : collection éditoriale d'un livre et type de liste utilisateur ne sont pas le même concept.                                               |
| 41  | §7 — Règles de conduite                                                                                 | `admin_reports_clause_placeholder`, `moderation_terms_conduct`                                                             | Réutiliser `moderation_terms_conduct` pour la même référence aux CGU ; reste dans `other`.                                                                      |
| 42  | Abandonné                                                                                               | `media_status_dropped`, `library_status_dropped`                                                                           | Réutiliser `library_status_dropped` pour le statut commun aux bibliothèques ; reste dans `other`.                                                               |
| 43  | Streaming                                                                                               | `media_streaming`, `stats_ownership_streaming`, `ownership_streaming`                                                      | Réutiliser `ownership_streaming` pour les statistiques de possession. Vérifier séparément le libellé d'offre `media_streaming`, dont le contexte peut évoluer.  |
| 44  | Tu as arrêté et ne comptes pas le reprendre.                                                            | `media_status_dropped_hint`, `library_status_dropped_description`                                                          | Réutiliser `library_status_dropped_description`, déjà transversal aux bibliothèques.                                                                            |
| 45  | Emprunté                                                                                                | `stats_ownership_borrowed`, `ownership_borrowed`                                                                           | Réutiliser `ownership_borrowed` pour les statistiques de possession.                                                                                            |
| 46  | {count} éléments                                                                                        | `admin_cache_item_count`, `admin_library_item_count_many`                                                                  | Mutualiser le compteur complet, par exemple `common_item_count_many`, avec son singulier ; ne pas concaténer le nombre et le nom.                               |
| 47  | Terminé                                                                                                 | `media_status_completed`, `game_status_completed`                                                                          | Mutualiser sous `library_status_completed` dans `other` ; ne pas utiliser `common_finish`, qui est une action.                                                  |

## 6. Faux doublons à ne pas fusionner

- `game_view` et `media_season_watched` : « Vue », mais « View » (perspective du
  jeu) contre « Watched » (saison visionnée).
- `profile_follow_following` et `nav_section_tracking` : « Suivi », mais
  « Following » (relation sociale) contre « Tracking » (suivi des œuvres).
- `book_rereads` / `game_replays` et leurs actions de suppression : même texte
  français actuellement, mais « Rereads » contre « Replays ». Garder deux concepts
  et revoir la formulation française des jeux.
- `common_finish` et les statuts `*_status_completed` : action contre état.
- `media_status_watching` et `game_status_playing` : « En cours » en FR, mais
  « In progress » / « Playing » en EN.
- `common_disabled` et `settings_communications_cadence_disabled` :
  « Disabled » / « Off », état de contrôle contre option de fréquence.
- `lists_kind_collection` et `book_collection` : type de liste contre collection
  éditoriale, même si FR et EN sont identiques.
- Les tarifs de plusieurs services tiers, même tous « gratuit » aujourd'hui,
  doivent pouvoir évoluer séparément.

## 7. Procédure pour les prochaines migrations

1. Chercher d'abord le concept dans `common`, puis dans les familles métier de
   `other`, dans **les deux langues**. Vérifier quelques usages existants.
2. Réutiliser la clé si le sens correspond. Sinon, créer une clé générique pour
   un libellé transversal ou une clé métier clairement nommée dans `other`.
3. Garder une phrase complète avec ses paramètres. Éviter de reconstruire une
   phrase traduite en accolant nom, nombre, préfixe et suffixe.
4. Pour un regroupement, mettre à jour les deux catalogues et tous les
   consommateurs, y compris `$lib/components`. Ne supprimer une ancienne clé
   qu'après vérification de tous ses usages.
5. Régénérer Paraglide ; ne pas modifier les fichiers générés à la main.
6. Exécuter les tests et le contrôle Svelte, puis vérifier les parcours FR/EN.
   Vérifier aussi le changement de langue pour les tableaux de labels construits
   au chargement d'un module.
7. Ajouter des contrôles de cohérence persistants pour les collisions et la
   parité des catalogues. Signaler les textes identiques comme candidats à revoir,
   sans interdire automatiquement les doublons de valeur légitimes.

Les tests existants de `routes/app/i18n.spec.ts` couvrent les attributs statiques
utilisateur et la présence des clés utilisées dans les routes. Ils ne démontrent
pas l'absence de toutes les chaînes en dur dans les scripts, les concaténations
ou les composants importés. La migration ajoute une couverture propre aux
composants, décrite dans la section 10.

## 8. Vérifications de l'audit initial

- Analyse des six catalogues JSON : contrôles structurels et FR/EN ci-dessus.
- Analyse des templates des 106 composants Svelte, complétée par la recherche
  de chaînes dans les scripts et la lecture des deux helpers de statistiques.
- Aucun changement du code applicatif ni des catalogues ; pas de build de
  production pour cette modification documentaire.
- Avant ce nettoyage, les 54 tests existants passaient après une relance avec
  moins de parallélisme, suite à un dépassement de délai dans le test FR des
  constantes.

## 9. Vérifications après nettoyage

- Les 7 nouveaux tests de `apps/web/src/catalogs.spec.ts` contrôlent les collisions
  de clés, leur classement, la parité FR/EN et les paramètres, la réutilisation des
  génériques, la distinction action/statut et les appels Paraglide dans les sources
  Svelte et TypeScript. Les commentaires ne sont pas considérés comme des appels.
- Avant correction, les tests reproduisaient les doublons avec `common`, les
  génériques mal classés et la mauvaise formulation française de `common_finish`.
- Après correction : **61 tests réussis dans 12 fichiers** avec
  `node node_modules/vitest/vitest.mjs run --maxWorkers=1` depuis `apps/web`.
  Les deux essais précédents avec deux workers ont dépassé le délai du test FR
  existant des constantes. Aucun délai ni assertion n'a été modifié ; la relance
  séquentielle a réussi une fois les autres vérifications terminées.
- Aucun ancien identifiant des 99 clés remplacées ne subsiste dans les sources
  frontend hors fichiers générés. Aucun ne subsiste dans les catalogues FR/EN.
- Régénération Paraglide réussie ; les fichiers générés ne sont pas modifiés à la
  main et restent ignorés par Git.
- `svelte-check` : **0 erreur**, les 9 avertissements préexistants dans 5 composants
  restent présents (`CommentThread`, `EditProfileModal`, `ImportWizard`,
  `LibraryBrowser`, `ReadingGoalEditModal`).
- ESLint passe sur tous les fichiers source modifiés et le nouveau test.
- Build frontend de production réussi. L'avertissement Workbox préexistant sur
  le glob `prerendered/**/*.{html,json}` sans correspondance reste présent.
- Formatage Prettier et `git diff --check` vérifiés.
- Pas de validation visuelle dans le navigateur pour ce renommage de clés ; le
  contrôle visuel FR/EN des composants reste dans la liste des prochains lots.

## 10. Vérifications après migration des composants

- Les 4 tests de `apps/web/src/lib/components/i18n.spec.ts` couvrent les textes
  statiques des 106 composants, les phrases en dur dans les attributs dynamiques,
  la lecture des helpers dans la langue active et plusieurs compteurs FR/EN au
  singulier et au pluriel. Le test statique échouait avant migration avec
  211 occurrences à traiter. Cette analyse ne garantit pas la langue des données
  provenant de l'API ni celle de toute expression JavaScript possible.
- Suite frontend complète : **65 tests réussis dans 13 fichiers** avec
  `node node_modules/vitest/vitest.mjs run --maxWorkers=1` depuis `apps/web`.
- Paraglide régénéré ; les clés et paramètres FR/EN sont cohérents et les appels
  frontend sont contrôlés par les tests des catalogues.
- `svelte-check` : **0 erreur et 9 avertissements préexistants** dans les mêmes
  5 composants cités en section 9.
- ESLint passe sur tous les fichiers source modifiés et les deux nouveaux
  fichiers de tests. Formatage Prettier et `git diff --check` vérifiés.
- Build frontend de production réussi après les derniers ajustements de
  singulier/pluriel. L'avertissement Workbox préexistant sur le glob
  `prerendered/**/*.{html,json}` reste présent.
- Pas de recette visuelle FR/EN des parcours connectés pendant cette passe.
  Les contenus API/backend restent dans le suivi en tête de document.

## 11. Réponses d'import : migration et vérifications

- Les groupes utilisent leurs identifiants stables ; les tuiles exposent un
  `id` et, si nécessaire, `watchlistCount`. Les éléments exposent `context`
  (note, temps de jeu, épisodes vus, année, revisionnages et favori).
  Les producteurs communs couvrent TV Time, Trakt, Simkl, Goodreads, StoryGraph
  et Steam. Les nombres et textes sont présentés dans la langue active par
  `apps/web/src/lib/components/import-presentation.ts`.
- Les échecs asynchrones exposent `errorCode`, y compris lorsque les imports
  médias encapsulent une `AppException`. Le frontend utilise le résolveur
  d'erreurs existant et n'affiche plus le diagnostic brut `job.error`.
- Les titres importés sont préservés ; seul le titre de secours d'un jeu sans
  nom est traduit. Les types de médias dans la recherche de correspondance sont
  traduits, au lieu d'afficher `MOVIE` / `SERIES` / `ANIME`.
- Compatibilité : les anciens champs `label`, `sub`, `subtitle` et `error`
  restent disponibles pour les clients déjà en cache et les journaux existants.
  Face à une ancienne API sans les nouvelles données, le nouveau frontend
  affiche des libellés génériques traduits et omet les détails non traduisibles.
  Déployer l'API avant ou avec le frontend pour conserver tous les détails.
  Aucune migration de base de données ni modification des décisions d'import.
- Les tests API reproduisaient l'absence de codes et de données structurées
  avant correction. Les tests frontend reproduisaient le rendu direct des
  champs français et du type de média brut avant le raccordement des helpers.
- Tests du module d'import : **78 réussis dans 13 fichiers**. Suite API complète :
  **836 réussis dans 104 fichiers**. Suite frontend complète : **71 réussis dans
  14 fichiers**, dont 6 tests dédiés à la présentation des imports.
- Build du package partagé, contrôle TypeScript API, build API et build frontend
  réussis. Svelte : **0 erreur, 9 avertissements préexistants**. ESLint, Prettier
  et `git diff --check` validés. L'avertissement Workbox préexistant persiste.
- Aucun email, push ou import réel envoyé ; pas de déploiement ni de recette
  visuelle des parcours connectés pendant cette passe.

## 12. Derniers cas frontend : migration et vérifications

- `NotificationBell` utilise un présentateur pour les abonnements, demandes
  acceptées, réactions, invitations aux listes, signalements traités et titres
  de décisions de modération. Les contenus saisis par des personnes sont préservés.
- Sans changer l'API, les paramètres absents des anciennes notifications sont
  extraits uniquement des formulations fixes effectivement émises par les
  producteurs actuels : nombre de réactions et enveloppe d'invitation autour du
  titre de liste. Les deux issues possibles d'un signalement sont distinguées.
  Les formulations inconnues ne sont pas interprétées arbitrairement ; une
  invitation générique ou un détail absent sert de repli. Ces adaptateurs devront
  suivre une éventuelle évolution du contrat backend des notifications.
- Les noms et fréquences des six tâches, ainsi que les libellés des quatorze
  modèles et dix-sept champs de prévisualisation sont traduits par identifiant.
  Les emails eux-mêmes ne sont pas modifiés.
- La page des services groupe désormais sur les identifiants `ServiceArea` de
  l'API, puis traduit seulement l'affichage. Elle ne compare plus « Jeux » à
  « Games » : les services restent visibles en anglais. Les détails d'état et le
  libellé OMDb sont localisés, y compris dans les statistiques système.
- Les deux sélecteurs de langue utilisent `getLocale()` lorsque le profil n'est
  pas encore disponible, et non un repli français codé en dur. Le mécanisme
  d'initialisation et sa langue de secours anglaise restent inchangés.
- Les durées des tâches/imports et l'intervalle entre sauvegardes utilisent le
  formatage numérique localisé ; l'unité de jour réutilise `common_days_short`.
- Les cinq tests de régression des branchements frontend échouaient avant les
  corrections. Les tests de présentation vérifient FR/EN, la conservation des
  données personnelles, les groupes de services complets et les replis connus.
- Suite frontend : **86 tests réussis dans 17 fichiers**. Svelte : **0 erreur,
  9 avertissements préexistants**. ESLint et formatage validés. Les cinq groupes
  de duplications bilingues volontaires de `common` / `other` restent inchangés.
- Build frontend de production réussi ; avertissement Workbox préexistant sur
  le glob de pages pré-rendues inchangé. Tentative de recette navigateur locale :
  l'écran de connexion s'affiche, les pages privées nécessitent une session admin.
- Cette passe modifie uniquement le frontend et ce suivi. Les modifications API
  de la section 11 étaient déjà présentes ; aucun email ni push n'a été modifié
  ou envoyé ici.
