# Idées de monétisation — P5 (hosted offer / entitlements)

Notes de brainstorm pour le module P5 du roadmap ("hosted offer / entitlements
— open core"). Compilation des pistes discutées, à trier/prioriser avant
implémentation. Rien ici n'est décidé ou codé.

## Positionnement

- Le **self-host reste gratuit et complet**, comme aujourd'hui (AGPL, "run it
  as a service, share your changes") — c'est l'ADN du produit, ça ne doit pas
  bouger.
- Le palier **Gratuit / Premium ne s'applique qu'à une offre hébergée**
  (une instance Tracklore multi-utilisateurs opérée par nous), via
  `User.entitlements` (`schema.prisma`), la seam déjà prévue depuis le début
  (actuellement vide en self-host).
- Pas de publicité sur le site (choix explicite) — les leviers ci-dessous sont
  pensés comme alternative aux pubs, pas en complément.

## Concurrents étudiés (paliers payants réels dans le même créneau)

| App | Ce qu'ils gatent |
|---|---|
| Trakt VIP | Listes/items illimités, filtres avancés, flux calendrier `.ics` personnalisés, stats par genre, "year in review", quota API plus élevé, badge |
| Plex Pass (self-hosted, référence de modèle) | Sync offline mobile, transcodage matériel, fonctions ML (reconnaissance visages/objets, détection auto intro/générique, radio "sonic similarity"), accès anticipé Labs |
| Letterboxd Pro/Patron | Stats avancées ("Year in Review" narratif, obscurité, rewatches), covers HD sur les listes, import/export, création de sondages |
| StoryGraph Plus | Stats mood/pace avancées, buddy reads/challenges illimités |

Enseignement principal : le levier le plus universel n'est pas d'inventer de
nouvelles fonctionnalités mais d'**enlever un plafond** sur ce qui existe déjà
(stats, listes, calendrier).

## Levier déjà à moitié construit : composition par domaines

`Domain` (schema.prisma) = `MEDIA, BOOKS, GAMES, MUSIC, PODCASTS, BOARDGAMES`.
`User.enabledDomains` + `DomainGateService.assertEnabled()` renvoient déjà un
403 serveur si un domaine est désactivé — exactement le mécanisme qu'il faut
pour un gate premium, il suffit de le brancher sur `entitlements` au lieu d'un
flag utilisateur libre.

- **Gratuit** : `MEDIA` seul (séries/films/anime, cœur historique du produit).
- **Premium** : `BOOKS + GAMES + MUSIC` (déjà livrés) + accès anticipé à
  `PODCASTS`/`BOARDGAMES` quand ils sortent (déjà teasés côté web comme
  "Bientôt").

## Idées de fonctionnalités premium — non-IA

**Import & synchronisation**
1. Sources d'import illimitées (TV Time, Steam, StoryGraph, + futures
   Goodreads/Babelio/Backloggd) — Gratuit = 1 source active, Premium = toutes.
2. Fréquence de refresh réduite (le TTL `lastSyncedAt` de 24h pourrait être
   plus court pour les comptes premium).
3. Resync manuel plus généreux — en hébergé, c'est nous qui payons/gérons les
   quotas TMDB/AniList/IGDB pour tout le monde ; contrairement au self-host où
   l'utilisateur fournit sa propre clé, ce plafond correspond à un vrai coût
   qu'on absorbe, pas une restriction artificielle.

**Notifications**
4. Alertes en temps réel vs digest quotidien groupé en gratuit.
5. Alertes étendues aux domaines premium (jeux, livres, musique).

**Calendrier**
6. Flux **.ics** exportable du calendrier de sorties (épisodes/jeux/livres
   suivis) vers Google/Apple Calendar — fait par Trakt, personne d'autre dans
   l'espace anime/games ne le fait bien. Faible coût de dev, forte valeur
   perçue.

**Social (P4, déjà livré à 100%)**
7. Listes partagées illimitées (vs plafond en gratuit).
8. **Figurant/ghost mode** comme argument premium "vie privée" — fonctionnalité
   forte, déjà finie (pseudonymisation à la volée, zéro stockage).
9. Sondages / listes collaboratives éditables à plusieurs (Letterboxd Patron).
10. Covers/bannières personnalisées de listes et de profil (cohérent avec
    l'identité visuelle "Séance" déjà posée dans `DESIGN.md`), vanity URL de
    profil.
11. Filtres/tri avancés sur les listes (mood, décennie, note, revisionnage).

**Data & fiabilité**
12. Sauvegardes admin déjà existantes (dump quotidien, rétention 7 jours) →
    en hébergé : rétention étendue + export multi-format à la demande pour le
    premium.
13. Stats "insights" plus poussées que le niveau actuel (par domaine, déjà
    livré en P3) : tendances annuelles, temps cumulé, etc.
14. "Bilan annuel" façon Letterboxd/Spotify Wrapped à partir des
    `EpisodeWatch`/reviews existants — fort potentiel viral (les gens
    partagent leur Wrapped), coûte peu vu que les stats de base existent déjà.

**Mobile**
15. App native (Capacitor, dernier morceau non fini de P2) avec sync
    offline — argument premium quand elle sortira.

**Confort d'usage**
16. Quotas généreux en gratuit sur le nombre d'éléments suivis / listes /
    imports simultanés, illimités en premium — le levier freemium le plus
    classique et le moins intrusif.

**Automatisation / écosystème**
17. API personnelle / webhooks avec quota plus élevé en premium — Trakt vit en
    partie de son écosystème d'apps tierces (Kodi, Home Assistant,
    Sonarr/Radarr) ; une clé API perso premium ouvre la voie à des
    intégrations communautaires sans qu'on doive toutes les construire.

## Idées de packaging / pricing (le modèle, pas juste le contenu)

18. **Achat à vie** en option (façon Trakt VIP Lifetime / Plex Pass Lifetime) —
    bon pour la trésorerie de lancement, moins bon pour un revenu récurrent
    prévisible ; à trancher selon l'objectif (cash flow immédiat vs MRR).
19. **Tarif fondateur** : les N premiers comptes hébergés à prix réduit à vie,
    pour amorcer une base payante avant maturité du produit.
20. **Parrainage** : exploite le système `Follow`/friends déjà existant (P4) —
    "invite un ami, vous gagnez tous les deux un mois premium".
21. **Patronage/don en complément** (Ko-fi, GitHub Sponsors) plutôt qu'à la
    place de l'abonnement — cohérent avec l'écosystème self-host (Jellyfin,
    Immich) ; peut cohabiter avec le premium plutôt que le remplacer.
22. **Plan famille** : plusieurs comptes liés à prix réduit — pertinent pour un
    produit à usage familial fréquent (suivi de séries), et prépare le terrain
    à des idées IA type décision de groupe (voir plus bas).
23. **Instance marque blanche** pour un club/serveur Discord de passionnés qui
    veut son propre Tracklore thématisé — segment B2B différent (un groupe qui
    paie collectivement) plutôt que des abonnements individuels.
24. **Liens affiliés "où regarder"** (façon JustWatch) sur les fiches — ce
    n'est pas une bannière intrusive, c'est une commission sur clic, donc un
    revenu indépendant de tout abonnement. Zone grise (certains le
    perçoivent comme une pub déguisée) : à trancher selon la tolérance du
    projet, mais techniquement compatible avec un plan gratuit sans pub
    classique.

## Anti-idée volontaire

25. **Ne jamais gater l'export/la portabilité des données**, y compris en
    hébergé. Goodreads est détesté pour ça. Le positionnement ("un TV Time que
    tu possèdes vraiment") perd son sens si l'export devient un argument
    premium — à garder gratuit partout, même si c'est un levier "facile" en
    apparence.

## Idées si intégration d'une IA (API Claude)

Certaines ont du sens **gratuites avec quota**, d'autres sont de bons
candidats premium parce qu'elles ont un coût réel par appel API à couvrir.

**Découverte & recommandation**
26. Recherche en langage naturel ("un film d'horreur psychologique, pas trop
    gore, années 90") traduite en requête catalogue.
27. Recommandations conversationnelles basées sur la bibliothèque réelle de
    l'utilisateur (notes, historique, listes) via function calling sur les
    endpoints existants — quota gratuit, illimité en premium.
28. Assistant de tri de watchlist ("tu as 340 films en attente, voici comment
    les prioriser par mood ou par ce que tu aimes vraiment").

**Confort de visionnage (assez unique dans ce créneau)**
29. **"Avant de reprendre"** : pour une série en pause depuis des mois,
    résumé spoiler-safe généré de tout ce qui s'est passé jusqu'au dernier
    épisode vu — gros différenciateur, cacheable par saison/épisode donc coût
    amorti sur tous les utilisateurs qui regardent la même série. Bon candidat
    premium naturel (coût par génération, mais mutualisé via cache).
30. Détection de spoilers dans les commentaires/reviews avant affichage
    (bouclier configurable par sensibilité) — base gratuite simple, réglages
    fins en premium.

**Enrichissement de catalogue (bénéficie à tous, coût interne pas par
utilisateur)**
31. Tags "ambiance"/mood générés par IA (cosy, slow-burn, feel-good) au-delà
    des genres bruts TMDB/AniList — job batch, mis en cache en base.
32. Assistance à la réconciliation d'import (TV Time/Steam/StoryGraph) quand
    le matching auto échoue — aujourd'hui correction 100% manuelle ; l'IA
    propose le bon candidat avec justification. Bon candidat "smart import"
    premium.
33. Traductions/polissage de synopsis quand la source ne fournit que
    l'anglais (cohérent avec l'UI 100% française du projet).
34. Résolution floue à l'ajout d'une œuvre (titre régional, orthographe
    approximative) — réduit la friction du tout premier geste utilisateur,
    un des moments les plus critiques pour la rétention.

**Social**
35. Pré-classification IA de la queue `/admin/reports` (module Report déjà
    branché sur COMMENT) pour prioriser la modération humaine — gain
    opérationnel plutôt que revenu direct.
36. **Pouls communautaire par œuvre** : résumé généré à partir de l'agrégat
    des reviews/commentaires existants sur une fiche ("ce que la communauté en
    pense" en 3 lignes) — exploite des données déjà collectées, pas de
    nouvelle collecte nécessaire.
37. Digest de notifications personnalisé et rédigé plutôt qu'un simple
    "3 nouveaux épisodes".

**Rétrospective**
38. "Bilan annuel" rédigé par l'IA plutôt que juste des graphiques — combine
    les stats existantes et la génération de texte, fort potentiel de partage
    social (= acquisition gratuite).

**Famille**
39. Mode "qu'est-ce qu'on regarde ce soir" : sur un plan famille, l'IA croise
    les goûts/notes de plusieurs profils du foyer et propose un compromis —
    exploite plan famille + IA ensemble, personne dans ce créneau ne le fait.

**Interne / outillage**
40. Copilote admin : requêtes en langage naturel sur `admin-stats`
    ("combien d'actifs ce mois, quelle rétention") — pas un revenu direct,
    évite de construire des dashboards sur mesure à chaque question.

## Priorisation suggérée (meilleur ratio effort/impact vu le code existant)

1. Flux `.ics` de calendrier (#6)
2. "Avant de reprendre" (#29)
3. Parrainage (#20)
