# Loomkeep en application mobile native

Ce qu'il reste à faire pour l'app mobile. Le détail de ce qui est livré est
dans les PR citées et dans l'historique de ce fichier.

## Choix d'architecture

- **Coque distante** : l'app Capacitor affiche le `/app` de l'instance
  (loomkeep.app par défaut) au lieu d'embarquer le web. Embarqué, le web
  tournerait sur `https://localhost` (cookies `SameSite=Strict` devenus
  tiers, donc un second transport d'authentification) et resterait figé à
  la version de l'APK, ce qui ferait de l'API interne un contrat public.
  En distant, web et API restent synchrones : une PR web arrive sur les
  téléphones au déploiement, seul un changement dans `apps/mobile` demande
  un nouvel APK.
- **APK installés anciens** : le web n'appelle un plugin natif que si
  `Capacitor.isPluginAvailable()` dit que l'APK l'a. Un plugin s'ajoute à
  la même version dans `apps/web` et `apps/mobile`.
- **Instance choisie à l'exécution** (MOB-15) : `server.url` est fixé à la
  création du pont, donc `MainActivity` le prend dans les préférences avant
  `super.onCreate`, et changer d'instance recrée l'activité.
- **Builds** : `ci.yml` publie un APK de debug (`app.loomkeep.debug`,
  pré-release `android-dev-<n>`) à chaque commit de `main`, et l'APK et
  l'AAB release (`app.loomkeep`, signés avec la clé release) avec chaque
  montée de version.

## Où on en est

Livré : MOB-01 à MOB-09, MOB-15, MOB-17, MOB-21, MOB-23, et la partie
Android de MOB-18 et MOB-19. Seuls MOB-01 et MOB-03 sont validés sur
téléphone ; le reste attend sa recette.

| Ticket | Titre                                               | Taille | Dépend de      | Statut                     |
| ------ | --------------------------------------------------- | ------ | -------------- | -------------------------- |
| MOB-10 | Publication sur Google Play                         | M      | —              | 🚧 reste le compte et Play |
| MOB-16 | Relais de push pour les instances self-hostées      | L      | —              | décisions à prendre        |
| MOB-20 | Widgets Android « À suivre » et « Sorties du jour » | L      | —              | 🚧 API et web en PR        |
| MOB-22 | Exploratoire : scrobbling musical Android           | L      | MOB-10         |                            |
| MOB-24 | Liens d'email vers l'app sur une autre instance     | S      | —              |                            |
| MOB-25 | Verrouillage de l'app par biométrie                 | S      | —              | si le besoin se confirme   |
| MOB-11 | Projet iOS + build CI macOS + TestFlight            | M      | —              | ⏳ plus tard               |
| MOB-12 | Push APNs (via FCM) et badge serveur                | S      | MOB-11         | ⏳ plus tard               |
| MOB-13 | Universal Links et passkeys iOS                     | M      | MOB-11         | ⏳ plus tard               |
| MOB-14 | Dossier de review et soumission App Store           | M      | MOB-12, MOB-13 | ⏳ plus tard               |

Tailles : S ≈ une journée, M ≈ deux à quatre jours, L ≈ une semaine ou
plus. ⏳ = pas prévu à court terme.

## Recette (tests sur téléphone)

Ce qui n'a pas encore été vérifié. Une ligne validée s'efface ; un ticket
dont il ne reste rien est validé.

**Avant de tester** : le dernier CI de `main` est vert et `Deploy` a
tourné. Obtainium suit `https://github.com/Logan2234/loomkeep` avec les
pré-releases cochées et sa détection de version désactivée : tous les APK
de dev d'une même version portent le même `versionName`. Installer
par-dessus l'ancien garde la session.

### Coque (MOB-01, MOB-02)

- [ ] Paramètres Android › Apps › Loomkeep Dev › Langue : en, fr, it.
      Introuvable sur un Poco X5 Pro (MIUI/HyperOS) : à chercher dans
      Paramètres supplémentaires › Langues et saisie.
- [ ] Retour depuis la page d'accueil : l'app passe en arrière-plan, sans
      clignoter entre /login et /app après une connexion.
- [ ] Icônes de la barre de statut lisibles en thème clair comme sombre,
      y compris juste après avoir changé de thème.

### Push natif (MOB-04, MOB-05)

- [ ] Réglages › Communications : activer le push demande la permission
      Android, et l'interrupteur reste activé en revenant sur la page.
- [ ] Paramètres Android › Loomkeep Dev › Notifications : six canaux
      (Activité, Sorties, Compte, Sécurité, Admin, Annonces) en français.
- [ ] Admin › Communications › Push : reçu app ouverte et app fermée ; le
      tap ouvre la page.
- [ ] Message de chat reçu sans Loomkeep ouvert nulle part : notification,
      et le tap ouvre la conversation.
- [ ] Une notification de la cloche ouverte depuis le push est marquée lue.
- [ ] Désactiver le push : plus rien n'arrive.

### Exports et partage (MOB-06)

- [ ] Réglages › Export, JSON puis CSV : la feuille de partage s'ouvre et
      « Enregistrer » produit un fichier lisible.
- [ ] Export de migration : les fichiers s'enchaînent, une feuille après
      l'autre.
- [ ] « Partager » sur une œuvre et sur un profil ouvre la feuille Android ;
      la fermer sans choisir n'affiche pas d'erreur.

### Scan natif (MOB-07)

- [ ] Recherche › Livres › caméra : l'écran de Google s'ouvre (le premier
      scan d'un APK installé à la main télécharge d'abord le module).
- [ ] Dos d'un livre : la recherche passe en mode ISBN avec le code.
- [ ] Code-barres d'un produit : « Ce code-barres n'est pas l'ISBN d'un
      livre ».
- [ ] Profil › scanner : le QR d'un autre profil l'ouvre ; un autre QR est
      refusé avec un message.

### App Links et passkeys (MOB-08)

- [ ] Un lien `https://loomkeep.app/app/settings` reçu par mail ou message
      ouvre l'app directement sur cette page (app fermée et ouverte).
- [ ] Le lien de réinitialisation de mot de passe ouvre l'app.
- [ ] « Se connecter avec une passkey » et la confirmation par passkey
      ouvrent la feuille de Google et aboutissent. Ne marchait pas au
      29/10 avec `android-dev-1443`, alors que l'APK et `assetlinks.json`
      sont bons : diagnostic en cours (`chrome://inspect`).

### Simkl (MOB-09)

- [ ] Réglages › Import › Simkl › Se connecter : Simkl s'ouvre dans un
      onglet par-dessus l'app (pas dans Chrome).
- [ ] Après « Autoriser », l'onglet se ferme et l'app affiche l'import
      Simkl, connectée ; l'import va au bout.

### Choix d'instance (MOB-15)

- [ ] Déconnecté : « Utiliser une autre instance » sous le formulaire de
      connexion ouvre l'écran de choix (absent dans un navigateur).
- [ ] `docs.loomkeep.app` est refusé (« n'est pas une instance Loomkeep »),
      une adresse inexistante aussi (« ne répond pas »).
- [ ] Une vraie instance self-hostée : l'app redémarre dessus, on peut s'y
      connecter, et elle reste choisie après avoir fermé l'app.
- [ ] « Utiliser loomkeep.app » ramène sur loomkeep.app, session conservée.
- [ ] En mode avion, la page d'erreur propose « Utiliser une autre
      instance » ; « Annuler » ramène à l'instance actuelle.

### Notifications actionnables (MOB-17)

- [ ] Après la mise à jour de l'APK, les notifications arrivent avec leurs
      boutons (relancer l'app une fois pour qu'elle le signale à l'API).
- [ ] Message de chat, app fermée : « Répondre » envoie la réponse sans
      ouvrir l'app, « Marquer comme lu » retire le badge de la conversation.
- [ ] Demande d'abonnement : « Accepter » et « Refuser » fonctionnent ;
      nouvel abonné : « Suivre en retour ».
- [ ] Réponse ou mention dans un commentaire : « Répondre » publie la
      réponse dans le fil.
- [ ] Une autre notification de la cloche : « Marquer comme lu ».
- [ ] Mode avion puis un bouton : la notification reste et dit que
      l'action a échoué ; le tap ouvre toujours la bonne page.
- [ ] Admin › Communications › Push, une notification « exemple » : elle
      arrive avec ses boutons, qui ne font rien.

### Partage et raccourcis (MOB-18, MOB-19)

- [ ] Depuis IMDb, Letterboxd ou Chrome, « Partager » propose Loomkeep Dev.
- [ ] Le lien partagé ouvre la page de partage de Loomkeep sur l'œuvre (ou
      une recherche quand le lien n'est pas reconnu).
- [ ] Appui long sur l'icône : Recherche, Calendrier, Statistiques,
      Mon profil, Paramètres, en français ; chaque raccourci ouvre sa page,
      app fermée comme ouverte.

### Haptique et passkey proposée (MOB-21)

- [ ] Petite vibration en marquant un épisode, une saison ou un film, depuis
      la fiche ou l'accueil, et à l'appui long dans la bibliothèque ;
      vibration plus marquée avec une bulle de succès ou de niveau. Ne
      vibrait pas au 29/10 : même diagnostic que les passkeys.
- [ ] Compte sans passkey : après une confirmation par mot de passe, un
      toast propose d'en ajouter une, une seule fois sur l'appareil.

---

## Android

### MOB-10 — Publication sur Google Play

Prêt : AAB et APK release signés avec la même clé et joints à chaque
release GitHub (`loomkeep-android-play.aab` pour Play), `targetSdk` 36,
suppression du compte dans l'app, politique de confidentialité à jour,
textes de la fiche et Data safety en annexe.

Reste :

- Compte Play Console (25 $) et vérification de l'identité. Un compte
  personnel neuf doit passer un test fermé de **12 testeurs pendant
  14 jours** avant la production ; un compte organisation (D-U-N-S) en est
  exempté.
- Play App Signing avec « utiliser une clé existante » : la clé release
  actuelle. L'APK de GitHub et celui de Play auront la même signature et se
  mettront à jour l'un par l'autre.
- Visuels : icône 512 × 512, bannière 1024 × 500, captures téléphone d'au
  moins 1080 px de large et au plus 2:1 (les `pwa-screenshot-*-mobile.jpg`
  actuelles, 375 × 811, ne passent pas).
- Page de suppression de compte utilisable sans l'app : Guide › Your data
  décrit le chemin dans l'app ; y ajouter le recours par email quand on ne
  peut plus se connecter, puis donner son adresse à Play.
- Saisir l'annexe dans la console, test fermé, puis production. Plus tard,
  envoi des AAB par l'API Play (compte de service en secret).

Google impose progressivement (2026-2027) que les APK installés hors Play
viennent de développeurs vérifiés : la distribution par GitHub passera par
cet enregistrement.

### MOB-16 — Relais de push pour les instances self-hostées

Les clés FCM appartiennent à l'app publiée : une instance self-hostée ne
peut pas envoyer de push à l'app. Piste : un service `push.loomkeep.app`
qui reçoit `{token, payload}` d'une instance enregistrée et le transmet à
FCM, avec limitation de débit ; `PUSH_RELAY_URL` côté instance, réglable
dans Admin › Settings.

À décider avant : chiffrer le payload de bout en bout (sur iOS, il faudra
une Notification Service Extension), et gratuit ou premium (`ee/`).

### MOB-20 — Widgets « À suivre » et « Sorties du jour »

Décidé le 29/10 (maquette : https://claude.ai/artifact/MkrxXX37TR2ogpNTbc3pBX) :

- Deux widgets, « À suivre » et « Sorties », en 2×2, 4×2 et 4×4 : 1, 3
  puis 6 éléments selon la taille. Style « Affiches » par défaut, « Liste »
  au choix dans les réglages du widget (reconfigurable, Android 12+).
- « À suivre » : séries et animes en cours avec un épisode à voir ; le
  bouton ✓ marque l'épisode suivant sans ouvrir l'app, le tap ouvre la
  fiche. « Sorties » : celles du jour, sinon « Prochaines sorties » avec
  leurs dates.
- Glance (Kotlin), mise à jour toutes les 30 minutes, après un ✓, et quand
  l'app passe en arrière-plan.
- Authentification : le web demande à l'API un jeton signé rattaché à sa
  session (`POST /api/home-screen-widgets/token`) et le remet au plugin
  local `HomeScreenWidgets` ; les widgets l'envoient en `X-Widget-Token`
  (`GET …/feed`, `POST …/watch-next`). Il meurt avec la session, et la
  déconnexion le retire.

Découpage : l'API et le web d'abord (sans effet tant qu'aucun APK n'a le
plugin), puis l'app Android.

Plus tard, d'autres widgets : chrono de session (jeu, lecture), série et
niveau (gamification), barre de recherche rapide.

### MOB-22 — Exploratoire : scrobbling musical

Lire les sessions média Android (à la Pano Scrobbler) pour enregistrer
automatiquement les écoutes dans le domaine musique. Vérifier d'abord la
politique Play sur l'accès aux notifications.

### MOB-24 — Liens d'email vers l'app sur une autre instance

Les App Links ne valent que pour les domaines déclarés dans le manifeste
au build : sur une instance self-hostée, les liens d'email (vérification,
mot de passe oublié, alertes) s'ouvrent dans le navigateur. Piste : un
schéma `loomkeep://` que l'instance ajoute à ses emails en bouton « Ouvrir
dans l'app ».

### MOB-25 — Verrouillage de l'app par biométrie

Réglage facultatif qui demande l'empreinte ou le visage à l'ouverture
(`BiometricPrompt` dans un plugin local, sans dépendance npm). La
re-confirmation des actions sensibles passe déjà par les passkeys
(MOB-21).

---

## iOS ⏳ plus tard

Attend un compte Apple Developer (99 €/an) et un environnement macOS
(runner `macos-latest`, Codemagic ou un Mac). La FSF juge les conditions
de l'App Store incompatibles avec la GPL : Logan peut publier son propre
code, et toute contribution externe passe par la CLA (`CLA.md`) pour que
ça reste vrai.

- **MOB-11** : `cap add ios`, build simulateur en CI, archive signée et
  upload TestFlight (fastlane, clé API App Store Connect en secret).
  Vérifier que le pont Capacitor s'injecte dans WKWebView sur la page
  distante.
- **MOB-12** : clé APNs `.p8` dans Firebase, même chemin d'envoi que le
  push Android ; le badge de l'icône vient du payload (nombre de non-lus).
- **MOB-13** : `/.well-known/apple-app-site-association` (`applinks`,
  `webcredentials`), associated domains, WebAuthn testé dans WKWebView. Sur
  une instance self-hostée, pas de passkeys dans l'app : un compte dont le
  seul second facteur est une clé doit pouvoir passer par le code email.
- **MOB-14** : notes de review qui argumentent le natif (règle 4.2), compte
  de démo, labels de confidentialité, fiche FR/EN/IT, captures iPhone.
- Parties iOS des tickets Android : Share Extension (partage vers
  Loomkeep), quick actions (raccourcis d'icône), WidgetKit (widgets).

---

## Annexe — Fiche Google Play et Data safety (MOB-10)

Brouillons à coller dans la Play Console. Les textes reprennent le ton de
la landing (tutoiement en français).

### Fiche

- **Nom** : Loomkeep
- **Catégorie** : Divertissement
- **Site** : https://loomkeep.app · **Email** : contact@loomkeep.app
- **Politique de confidentialité** : https://loomkeep.app/legal/privacy-policy

**Description courte** (80 caractères au plus)

- FR : Séries, films, animes, jeux, livres, albums : tout ce que tu suis, réuni.
- EN : Series, films, anime, games, books, albums: everything you follow, in one place.
- IT : Serie, film, anime, giochi, libri, album: tutto ciò che segui, in un solo posto.

**Description longue — FR**

> Loomkeep garde la trace de tout ce que tu regardes, joues, lis et
> écoutes : séries et animes épisode par épisode, films et revisionnages,
> jeux avec leur temps de jeu, livres page par page, albums. Une seule
> bibliothèque, une seule page de statistiques, au lieu d'une application
> par passion.
>
> • Suivi précis : saisons, épisodes, relectures, parties en cours,
> abandonnées ou terminées, avec les dates de chaque séance.
> • Calendrier des sorties : les prochains épisodes de tes séries, et un
> flux à ajouter à ton agenda.
> • Statistiques : ton année en séries, films, jeux, livres et musique.
> • Import de ton historique depuis TV Time, Trakt, Simkl, MyAnimeList,
> AniList, Letterboxd, IMDb, Steam, Goodreads, StoryGraph et Babelio.
> • Entre amis : profils, avis, listes partagées et messages.
>
> L'application ajoute les notifications Android (nouveaux épisodes,
> réponses, messages), le scan du code-barres d'un livre ou du QR code
> d'un ami, le partage d'un lien IMDb ou Letterboxd vers Loomkeep, et des
> raccourcis sur son icône.
>
> Loomkeep est gratuit et sans publicité. C'est un logiciel libre (AGPL) :
> tu peux exporter tes données à tout moment, ou héberger ta propre
> instance et y connecter l'application.

**Description longue — EN**

> Loomkeep keeps track of everything you watch, play, read and listen to:
> series and anime episode by episode, films and rewatches, games with
> their playtime, books page by page, albums. One library and one stats
> page, instead of one app per passion.
>
> • Precise tracking: seasons, episodes, rereads, games in progress,
> dropped or finished, with the date of every session.
> • Release calendar: your shows' upcoming episodes, and a feed for your
> own calendar.
> • Stats: your year in series, films, games, books and music.
> • Bring your history from TV Time, Trakt, Simkl, MyAnimeList, AniList,
> Letterboxd, IMDb, Steam, Goodreads, StoryGraph and Babelio.
> • With friends: profiles, reviews, shared lists and messages.
>
> The app adds Android notifications (new episodes, replies, messages),
> scanning a book's barcode or a friend's QR code, sharing an IMDb or
> Letterboxd link to Loomkeep, and shortcuts on its icon.
>
> Loomkeep is free and has no ads. It's free software (AGPL): export your
> data whenever you like, or host your own instance and connect the app to
> it.

**Description longue — IT**

> Loomkeep tiene traccia di tutto ciò che guardi, giochi, leggi e ascolti:
> serie e anime episodio per episodio, film e nuove visioni, giochi con il
> tempo di gioco, libri pagina per pagina, album. Una sola libreria e una
> sola pagina di statistiche, invece di un'app per ogni passione.
>
> • Tracciamento preciso: stagioni, episodi, riletture, giochi in corso,
> abbandonati o finiti, con la data di ogni sessione.
> • Calendario delle uscite: i prossimi episodi delle tue serie, e un feed
> da aggiungere al tuo calendario.
> • Statistiche: il tuo anno in serie, film, giochi, libri e musica.
> • Importa la tua cronologia da TV Time, Trakt, Simkl, MyAnimeList,
> AniList, Letterboxd, IMDb, Steam, Goodreads, StoryGraph e Babelio.
> • Con gli amici: profili, recensioni, liste condivise e messaggi.
>
> L'app aggiunge le notifiche Android (nuovi episodi, risposte, messaggi),
> la scansione del codice a barre di un libro o del QR di un amico, la
> condivisione di un link IMDb o Letterboxd verso Loomkeep, e scorciatoie
> sulla sua icona.
>
> Loomkeep è gratuito e senza pubblicità. È software libero (AGPL): puoi
> esportare i tuoi dati in qualsiasi momento, o ospitare la tua istanza e
> collegarci l'app.

### Data safety

Ce que l'app (donc le compte loomkeep.app) collecte, d'après la politique
de confidentialité. « Partage » au sens de Play : aucun, car les
prestataires (hébergement, email, FCM) agissent pour le compte de
Loomkeep, et les imports lancés par l'utilisateur en sont exclus.

| Catégorie Play                      | Donnée                                         | Obligatoire ? | Finalité                           |
| ----------------------------------- | ---------------------------------------------- | ------------- | ---------------------------------- |
| Infos personnelles › Email          | adresse du compte                              | oui           | gestion du compte, communications  |
| Infos personnelles › Nom            | nom d'utilisateur, nom d'affichage             | oui           | fonctionnalités, gestion du compte |
| Infos personnelles › ID utilisateur | identifiant du compte                          | oui           | gestion du compte                  |
| Infos personnelles › Autres infos   | date de naissance (contenus adultes), bio      | non           | fonctionnalités                    |
| Photos                              | avatar                                         | non           | fonctionnalités                    |
| Messages › Autres messages          | messages privés, commentaires                  | non           | fonctionnalités                    |
| Activité › Autre contenu généré     | bibliothèque, suivi, notes, avis, listes       | non           | fonctionnalités, personnalisation  |
| Activité › Interactions             | abonnements, réactions, blocages, signalements | non           | fonctionnalités, sécurité          |
| Infos et performances › Plantages   | rapports d'erreur (GlitchTip, auto-hébergé)    | oui           | analyse, sécurité                  |
| Infos et performances › Diagnostics | journaux techniques                            | oui           | sécurité, prévention de la fraude  |
| Identifiants de l'appareil          | jeton FCM                                      | non           | fonctionnalités (notifications)    |

- Chiffrement en transit : oui (HTTPS partout).
- Suppression : oui, depuis l'app (Réglages › Supprimer le compte) et par
  la page de suppression (voir MOB-10).
- Collecte pour la publicité ou partage avec des tiers : non.
- À vérifier avant de soumettre : que l'historique de recherche n'est pas
  conservé côté serveur, et que les SDK embarqués (Firebase Messaging,
  ML Kit) ne collectent rien d'autre que Play compterait au nom de l'app.

### Classification du contenu et public cible

- Public cible : 15 ans et plus (âge minimum des conditions
  d'utilisation) ; l'app ne s'adresse pas aux enfants.
- Contenu généré par les utilisateurs : oui (profils, avis,
  commentaires, messages privés), avec blocage, signalement et
  modération.
- Interaction entre utilisateurs : oui. Partage de position : non. Achats
  numériques : non.
- Œuvres pour adultes : le catalogue peut en référencer ; leur accès est
  limité par l'âge déclaré et les réglages du compte.
