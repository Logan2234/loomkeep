# Loomkeep en application mobile native

Plan de découpage en tickets pour publier Loomkeep sur le Play Store et
l'App Store, au-delà du PWA. Répond notamment au ticket Quackback
« Native push notifications (Capacitor) » (`post_01kznnr90wfetr9s3z551fk3xk`).

## Choix d'architecture

**Capacitor, en mode « coque distante »** : l'application native affiche
dans une WebView système le `/app` servi par l'instance (loomkeep.app par
défaut), et lui ajoute des capacités natives via des plugins.

Pourquoi pas le mode standard de Capacitor (front embarqué dans le
binaire) :

- l'origine de la WebView deviendrait `https://localhost` /
  `capacitor://localhost` : les cookies de session `SameSite=Strict`
  deviendraient tiers, il faudrait un second transport d'authentification
  (Bearer + refresh token en Keychain) ;
- un binaire installé resterait figé à sa version alors que l'API se
  redéploie à chaque merge sur `main` : l'API interne, aujourd'hui non
  versionnée et déployée de concert avec le web, deviendrait un contrat
  public à garder rétrocompatible ;
- une instance self-hostée plus ancienne ou plus récente que l'app
  poserait le même problème en sens inverse.

En mode distant, web et API restent synchrones, les cookies restent
first-party (Caddy sert `/api` et le web sur la même origine) et une
instance self-hostée se résume à une URL. Contreparties à traiter : un
écran hors ligne local (MOB-15) et assez de natif réel pour passer la règle
App Store 4.2 « minimum functionality » (push, scan, partage, widgets).
Capacitor présente `server.url` comme destiné au live reload : MOB-01 sert
justement à valider ce mode avant d'investir dessus.

Alternatives écartées : TWA (Android seulement, quasi aucun accès natif —
reste un plan B pour être sur le Play Store très vite), Tauri 2 (écosystème
mobile plus jeune, pas de push distant officiel), React Native / Flutter
(réécriture complète du front), coque Swift/Kotlin maison (deux bases
natives à maintenir).

## Vue d'ensemble

| Ticket | Titre                                                  | Phase | Taille | Dépend de      | Statut                    |
| ------ | ------------------------------------------------------ | ----- | ------ | -------------- | ------------------------- |
| MOB-01 | Coque Capacitor Android + APK de debug en CI           | 0     | S      | —              | ✅ #433 📱                |
| MOB-02 | Intégration web ↔ natif (plateforme, retour, statut)   | 1     | M      | MOB-01         | ✅ #436                   |
| MOB-03 | Icônes, splash screen et nom d'application             | 1     | S      | MOB-01         | ✅ #436 📱                |
| MOB-04 | API : push natif via FCM                               | 1     | M      | —              | ✅ #438                   |
| MOB-05 | Web : enregistrement et ouverture des push natifs      | 1     | M      | MOB-02, MOB-04 | ✅ #438                   |
| MOB-06 | Exports et téléchargements dans l'app                  | 1     | S      | MOB-02         | ✅ #436                   |
| MOB-07 | Scan ISBN et QR natif                                  | 1     | M      | MOB-02         | ✅ #439                   |
| MOB-08 | Android App Links (liens d'email et de partage)        | 1     | S      | MOB-01         | ✅ #436                   |
| MOB-09 | Connexion Simkl via navigateur in-app                  | 1     | M      | MOB-08         | ✅ #447                   |
| MOB-10 | Publication Android (signature, fiche, test fermé)     | 1     | M      | MOB-03, MOB-05 | 🚧 en partie              |
| MOB-11 | Projet iOS + build CI macOS + TestFlight               | 2     | M      | MOB-02         | ⏳ plus tard              |
| MOB-12 | Push APNs (via FCM) et badge serveur                   | 2     | S      | MOB-04, MOB-11 | ⏳ plus tard              |
| MOB-13 | Universal Links et passkeys iOS                        | 2     | M      | MOB-11         | ⏳ plus tard              |
| MOB-14 | Dossier de review et soumission App Store              | 2     | M      | MOB-12, MOB-13 | ⏳ plus tard              |
| MOB-15 | Écran local : choix d'instance et hors ligne           | 3     | M      | MOB-02         | ✅ #459, #460             |
| MOB-16 | Relais de push pour les instances self-hostées         | 3     | L      | MOB-04, MOB-15 |                           |
| MOB-17 | Notifications actionnables                             | 4     | M      | MOB-05         | 🚧 #476 (API)             |
| MOB-18 | Partager vers Loomkeep (intent Android, extension iOS) | 4     | L      | MOB-02, MOB-11 | ✅ #447 (Android), iOS ⏳ |
| MOB-19 | Raccourcis d'icône (quick actions)                     | 4     | S      | MOB-02         | ✅ #439 (Android), iOS ⏳ |
| MOB-20 | Widgets « À suivre » et « Sorties du jour »            | 4     | L      | MOB-02         | iOS ⏳                    |
| MOB-21 | Haptique et biométrie pour la re-confirmation          | 4     | M      | MOB-02         |                           |
| MOB-22 | Exploratoire : scrobbling musical Android              | 4     | L      | MOB-10         |                           |
| MOB-23 | APK release sur GitHub, landing et docs                | 1     | M      | MOB-03, MOB-15 | ✅ #461                   |

Statut : ✅ = mergé dans `main`, avec le numéro de la PR qui le livre ;
📱 = validé sur téléphone (voir « Recette » plus bas) ; 🚧 = en partie
(le ticket dit ce qui reste) ; ⏳ = plus tard, pas prévu à court terme
(toute la phase iOS, et les parties iOS des tickets de la phase 4).

Tailles : S ≈ une demi-journée à une journée, M ≈ deux à quatre jours,
L ≈ une semaine ou plus.

## Prérequis hors code

- Compte Google Play Console (25 $ une fois). Un compte personnel neuf
  doit passer un test fermé de **12 testeurs pendant 14 jours** avant la
  production ; un compte organisation (numéro D-U-N-S) en est exempté.
- ⏳ iOS, plus tard : compte Apple Developer (99 €/an) et un iPhone de
  test, ou TestFlight.
- Projet Firebase (gratuit) pour FCM, avec une app Android par nom de
  paquet (`app.loomkeep.debug`, `app.loomkeep`).
- Clé de signature release (MOB-23) : générée une fois, sauvegardée hors du
  repo. Perdue, plus aucune installation ne peut être mise à jour.
- ⏳ iOS, plus tard : un environnement macOS (runner `macos-latest` de
  GitHub Actions, Codemagic ou un Mac mini). Android se construit sur
  Windows (Android Studio) et en CI Ubuntu.
- AGPL et App Store : la FSF juge les conditions de l'App Store
  incompatibles avec la GPL. En tant que titulaire des droits, Logan peut
  publier son propre code ; toute contribution externe doit passer par la
  CLA (`CLA.md`) pour que ce reste vrai.

---

## Recette (tests sur téléphone)

À cocher au fil des tests ; une case cochée partout pour un ticket lui vaut
son 📱 dans le tableau.

### Avant de tester

- [x] Le dernier CI de `main` est vert **et** `Deploy` a tourné : l'app
      affiche le web de l'instance, donc rien de ce qui est web ne se teste
      avant le déploiement. Contrôle rapide :
      `https://loomkeep.app/.well-known/assetlinks.json` ne renvoie plus la
      page 404 du site.
- [x] Dernier APK de `main` installé **par-dessus** l'ancien (même clé de
      debug : la session est gardée). Chaque build natif de `main` est publié
      en pré-release `android-dev-<n>` ; Obtainium la suit : ajouter
      `https://github.com/Logan2234/loomkeep` en cochant les pré-releases,
      et désactiver sa détection de version (le `versionName` ne change
      qu'aux montées de version).
- [x] VPS : `FCM_SERVICE_ACCOUNT_BASE64` (push) et
      `ANDROID_APP_LINKS=app.loomkeep.debug=<SHA-256 de la clé de debug>`
      (App Links) dans le `.env`.

### MOB-01 — Coque

- [x] L'app ouvre loomkeep.app/app et la connexion fonctionne.
- [x] La session survit à la fermeture de l'app.

### Réglages de la coque (#436)

- [x] « Loomkeep Dev » s'installe à côté d'une éventuelle « Loomkeep ».
- [x] Pas de flash blanc au lancement.
- [x] Mode avion : page « Impossible de charger Loomkeep » ; réseau revenu,
      « Réessayer » recharge l'app.
- [ ] Paramètres Android › Apps › Loomkeep Dev › Langue : en, fr, it.
      Introuvable sur un Poco X5 Pro (MIUI/HyperOS) : à chercher dans
      Paramètres supplémentaires › Langues et saisie.

### MOB-02 — Intégration web ↔ natif

- [x] Une modale ou un tiroir ouvert se ferme au bouton retour, sans
      changer de page.
- [ ] Retour depuis la page d'accueil : l'app passe en arrière-plan.
      Après une connexion, l'app clignotait (/login ↔ /app) : corrigé,
      à revérifier.
- [ ] Icônes de la barre de statut lisibles en thème clair comme sombre,
      y compris juste après avoir changé de thème.
      La barre restait claire en thème sombre : corrigé (ShellTheme),
      à revérifier.
- [x] Rien ne passe sous l'heure et la batterie (fiche d'œuvre en faisant
      défiler, cloche, bulle de succès).

### MOB-03 — Icônes et écran de lancement

- [x] Icône Loomkeep, ronde ou carrée selon le launcher.
- [x] Icônes à thème (Android 13+) : l'icône prend les couleurs du système.
- [x] Lancement : logo sur fond sombre.

### MOB-04 / MOB-05 — Push natif

- [ ] Réglages › Communications : activer le push demande la permission
      Android, et l'interrupteur reste activé en revenant sur la page.
- [ ] Paramètres Android › Loomkeep Dev › Notifications : six canaux
      (Activité, Sorties, Compte, Sécurité, Admin, Annonces) en français.
- [ ] Admin › test de push : reçu app ouverte et app fermée ; le tap ouvre
      la page.
- [ ] Message de chat reçu sans Loomkeep ouvert nulle part : notification,
      et le tap ouvre la conversation.
- [ ] Une notification de la cloche ouverte depuis le push est marquée lue.
- [ ] Désactiver le push : plus rien n'arrive.

### MOB-06 — Exports et partage

- [ ] Réglages › Export, JSON puis CSV : la feuille de partage s'ouvre et
      « Enregistrer » produit un fichier lisible.
- [ ] Export de migration : les fichiers s'enchaînent, une feuille après
      l'autre.
- [ ] « Partager » sur une œuvre et sur un profil ouvre la feuille Android ;
      la fermer sans choisir n'affiche pas d'erreur.

### MOB-07 — Scan natif

- [ ] Recherche › Livres › caméra : l'écran de Google s'ouvre (le premier
      scan d'un APK installé à la main télécharge d'abord le module).
- [ ] Dos d'un livre : la recherche passe en mode ISBN avec le code.
- [ ] Code-barres d'un produit : « Ce code-barres n'est pas l'ISBN d'un
      livre ».
- [ ] Profil › scanner : le QR d'un autre profil l'ouvre ; un autre QR est
      refusé avec un message.

### MOB-08 — App Links

- [ ] `https://loomkeep.app/.well-known/assetlinks.json` renvoie le JSON
      avec `app.loomkeep.debug`.
- [ ] Un lien `https://loomkeep.app/app/settings` reçu par mail ou message
      ouvre l'app directement sur cette page (app fermée et ouverte).
- [ ] Le lien de réinitialisation de mot de passe ouvre l'app.
- [ ] `assetlinks.json` donne aussi `delegate_permission/common.get_login_creds`
      à chaque paquet ; dans l'app, « Se connecter avec une passkey » et la
      confirmation par passkey ouvrent la feuille de Google et aboutissent.

### MOB-19 — Raccourcis de l'icône

- [ ] Appui long sur l'icône : Recherche, Calendrier, Statistiques,
      Mon profil, Paramètres, en français.
- [ ] Chaque raccourci ouvre sa page, app fermée comme ouverte.

### MOB-09 — Simkl

- [ ] Réglages › Import › Simkl › Se connecter : Simkl s'ouvre dans un
      onglet par-dessus l'app (pas dans Chrome).
- [ ] Après « Autoriser », l'onglet se ferme et l'app affiche l'import
      Simkl, connectée ; l'import va au bout.

### MOB-17 — Notifications actionnables

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

### MOB-18 — Partager vers Loomkeep

- [ ] Depuis IMDb, Letterboxd ou Chrome, « Partager » propose Loomkeep Dev.
- [ ] Le lien partagé ouvre la page de partage de Loomkeep sur l'œuvre (ou
      une recherche quand le lien n'est pas reconnu).

### MOB-15 — Choix d'instance

- [ ] Déconnecté : « Utiliser une autre instance » sous le formulaire de
      connexion ouvre l'écran de choix (absent dans un navigateur).
- [ ] `docs.loomkeep.app` est refusé (« n'est pas une instance Loomkeep »),
      une adresse inexistante aussi (« ne répond pas »).
- [ ] Une vraie instance self-hostée : l'app redémarre dessus, on peut s'y
      connecter, et elle reste choisie après avoir fermé l'app.
- [ ] « Utiliser loomkeep.app » ramène sur loomkeep.app, session conservée.
- [ ] En mode avion, la page d'erreur propose « Utiliser une autre
      instance » ; « Annuler » ramène à l'instance actuelle.

---

## Phase 0 — Fondations

### MOB-01 — Coque Capacitor Android + APK de debug en CI

**But** : valider le mode coque distante avec un APK installable, sans
toucher au web ni à l'API.

**Périmètre**

- Nouveau workspace `apps/mobile` (`@loomkeep/mobile`) : Capacitor 8,
  `capacitor.config.ts` (`appId` `app.loomkeep`, `server.url` vers
  `https://loomkeep.app/app`, surchargeable par `LOOMKEEP_APP_URL` pour
  pointer l'émulateur sur le serveur de dev), projet `android/` généré et
  commité.
- Workflow `mobile.yml` : `cap sync android` puis `assembleDebug`, APK
  publié en artefact du run.
- Version de `apps/mobile/package.json` alignée sur les autres (lockstep
  passé à six fichiers, skill `version-bump` et `CLAUDE.md` à jour).

**Critères d'acceptation**

- Le workflow produit un `app-debug.apk` téléchargeable.
- Installé sur un téléphone, l'APK ouvre `loomkeep.app/app`, la connexion
  fonctionne et la session survit à un redémarrage de l'app.
- Vérifier dans la WebView (`chrome://inspect`) que `window.Capacitor` est
  présent sur la page distante : c'est la condition pour tous les tickets
  suivants.

**Hors périmètre** : tout changement dans `apps/web`, icônes, iOS.

---

## Phase 1 — Android utilisable

### MOB-02 — Intégration web ↔ natif

**But** : que le web se comporte en app quand il tourne dans la coque.

**Périmètre**

- `@capacitor/core` dans `apps/web` et un module de détection
  (`isNativeApp()`) ; aucun code natif ne doit se charger hors de la coque.
- Bouton retour Android (`@capacitor/app`) : ferme d'abord la modale
  ouverte, remonte ensuite l'historique, et met l'app en arrière-plan à la
  racine.
- Icônes des barres système suivant le thème Séance (plugin `SystemBars`
  intégré à Capacitor 8), clair/sombre suivi en direct.
- Safe areas vérifiées en plein écran ; pas de bannière d'installation PWA
  ni de proposition Web Push dans la coque.
- Service worker non enregistré dans la coque (il n'y apporte rien et
  complique les mises à jour).

**Critères d'acceptation** : retour Android cohérent sur toutes les pages
à onglets et modales ; aucune régression dans le navigateur (tests
composants sur `isNativeApp()` faux).

### MOB-03 — Icônes, splash screen et nom d'application

**Périmètre** : icône adaptative Android dessinée en vectoriel depuis
`favicon.svg`, écran de lancement aux couleurs Séance via le thème Android
(sans plugin), nom affiché « Loomkeep » (« Loomkeep Dev » en debug).

**Critères d'acceptation** : icône correcte en rond, carré et thème
monochrome Android 13+ ; pas de flash blanc au démarrage en thème sombre.

### MOB-04 — API : push natif via FCM

**But** : envoyer les alertes `ALERTS` sur les appareils natifs.

**Périmètre**

- Prisma : `PushSubscription` gagne `platform` (`WEB`/`ANDROID`, `IOS`
  viendra avec MOB-12) ; une ligne Android range son token FCM dans
  `endpoint`, sans `p256dh` ni `auth`. Migration.
- `IsPushEndpoint` ne s'applique qu'au Web Push ; un token natif a sa
  propre validation.
- `PushService` choisit l'émetteur par plateforme : Web Push inchangé,
  FCM HTTP v1 (compte de service en variable d'environnement, désactivé
  proprement si absente) pour Android et iOS.
- Tokens que FCM déclare `UNREGISTERED` supprimés, comme les 410 du Web
  Push ; une autre erreur ne supprime rien.
- Payload : titre et corps depuis `notification-copy.ts`, chemin `/app/...`
  à ouvrir, groupe `ALERTS` (le canal Android).
- `GET /notifications/push/public-key` indique (`nativeEnabled`) si
  l'instance a FCM configuré, pour que le web ne propose pas le push natif
  quand il ne peut pas aboutir.

**Critères d'acceptation** : tests unitaires du dispatch et du nettoyage ;
cas e2e d'enregistrement d'un token natif ; une alerte coupée dans
`User.alertPrefs` n'est pas envoyée sur le natif non plus.

### MOB-05 — Web : enregistrement et ouverture des push natifs

**Périmètre**

- `push.ts` utilise `@capacitor/push-notifications` dans la coque, le Web
  Push ailleurs ; même interface pour Settings › Communications et
  l'onboarding.
- Un canal de notification Android par groupe d'`ALERTS` (activité,
  sorties, compte, sécurité, admin, annonces) : un par type en aurait fait
  une cinquantaine dans les paramètres Android.
- Build sans `google-services.json` : le plugin est exclu (il ferait
  planter l'app), et le web considère le push indisponible.
- Tap sur une notification : navigation vers le chemin du payload, app
  froide ou en arrière-plan.

**Critères d'acceptation** : activer, désactiver et recevoir sur un
appareil réel ; l'appareil disparaît des réglages après désinstallation
(token refusé puis nettoyé).

### MOB-06 — Exports et téléchargements dans l'app

**Périmètre** : `downloadBlob` et les téléchargements serveur
(`Content-Disposition`) passent par `@capacitor/filesystem` puis la feuille
de partage (`@capacitor/share`) dans la coque, où `a.download` sur une URL
blob ne fait rien.

**Critères d'acceptation** : chaque export de Settings produit un fichier
partageable ou enregistrable ; l'import de fichiers (CSV TV Time, ZIP
Trakt…) fonctionne depuis le sélecteur Android.

### MOB-07 — Scan ISBN et QR natif

**Périmètre** : dans la coque, le scan ISBN de la recherche et le scan de
QR de profil ouvrent le scanner prêt à l'emploi de Google Play services
(`@capacitor-mlkit/barcode-scanning`) au lieu des modales web ; le bouton
apparaît même sans `BarcodeDetector`. L'écran de Google tient la caméra :
aucune permission à demander.

**Critères d'acceptation** : scan d'un EAN-13 et d'un QR de profil sur
Android ; un code qui n'est ni un ISBN ni un profil le dit ; annuler ne
fait rien.

### MOB-08 — Android App Links

**Périmètre** : `/.well-known/assetlinks.json` servi par le web (empreinte
de la clé de signature en configuration), intent-filters sur
`loomkeep.app/app/*`, `/u/*` et les pages de vérification ; un lien d'email
ou de partage ouvre l'app sur la bonne page.

**Critères d'acceptation** : `adb shell pm get-app-links app.loomkeep`
renvoie `verified` ; lien de réinitialisation de mot de passe ouvert dans
l'app.

### MOB-09 — Connexion Simkl via navigateur in-app

**Problème** : Google refuse les connexions dans une WebView
(`disallowed_useragent`), et le navigateur in-app ne partage pas les
cookies de la WebView.

**Périmètre** : flux OAuth Simkl ouvert dans un Custom Tab
(`@capacitor/browser`) ; la redirection vers le callback est un App Link
qui ramène l'app (son activité `singleTask` ferme l'onglet) et route la
WebView vers le callback, qui finalise l'import avec la session de l'app.
Si Simkl ne montrait pas d'écran de consentement, Chrome pourrait garder
la redirection dans l'onglet : repli prévu, le flux PIN de Simkl.

**Critères d'acceptation** : import Simkl complet depuis l'app Android, et
flux navigateur inchangé.

### MOB-10 — Publication Android

**But** : publier `app.loomkeep` sur Google Play, ce qui règle aussi la
vérification des développeurs qu'Android impose aux APK installés hors
store (voir MOB-23).

**Déjà fait**

- Clé de signature release en secrets GitHub, APK release signé et
  vérifié par la CI (MOB-23). Elle peut servir de clé de signature Play
  (Play App Signing, « utiliser une clé existante ») : l'APK de GitHub et
  celui du Play Store auront la même signature, et l'un pourra se mettre
  à jour par l'autre.
- `versionCode` dérivé de la version lockstep (#441) ; `targetSdk` 36,
  au niveau de ce que Play exige.
- Doc utilisateur dans `apps/docs` (Guide › Android app, MOB-23).
- Suppression du compte depuis l'app (Réglages › Supprimer le compte).
- Bundle `bundleRelease` (AAB, le seul format accepté par Play), construit
  avec l'APK release, signé avec la même clé et vérifié par la CI, puis
  joint à la release GitHub de la version (`loomkeep-android-play.aab`),
  d'où on l'envoie à Play.
- Politique de confidentialité : section 21 « Application Android »
  (téléchargement, scanner de Google, passkeys, données sur l'appareil),
  et la section 7 précise que les notifications de l'app ne sont pas
  chiffrées de bout en bout pour Google.
- Textes de la fiche, réponses Data safety et classification du contenu :
  brouillons prêts dans l'annexe en fin de document.

**Reste à faire**

- Compte Play Console (25 $) et vérification de l'identité du développeur.
- Visuels : icône 512 × 512, bannière 1024 × 500, et de nouvelles captures
  téléphone. Les `static/pwa-screenshot-*-mobile.jpg` actuelles
  (375 × 811) dépassent le rapport 2:1 que Play accepte, et Play
  recommande au moins 1080 px de large.
- Page de suppression de compte : Guide › Your data décrit le chemin dans
  l'app ; y ajouter le recours par email quand on ne peut plus se
  connecter, puis donner son adresse à Play.
- Saisir l'annexe dans la console, puis test fermé (12 testeurs, 14 jours)
  et production. Plus tard, envoi des AAB par l'API Play (compte de
  service en secret) au lieu de l'envoi manuel.

### MOB-23 — APK release sur GitHub, landing et docs

**But** : distribuer l'app Android sans store, en attendant MOB-10.

**Périmètre**

- Build release (`app.loomkeep`, « Loomkeep », WebView non inspectable)
  signé avec la clé release, construit par `ci.yml` sur le commit `main`
  qui change la version, et joint à la release GitHub `v<version>` de
  l'application entière (créée par le même run) ; jusqu'à 1.11.0, c'était une release
  séparée `android-v<version>`. Les pré-releases `android-dev-<n>` restent
  pour les tests. Obtainium suit ces releases.
- Page de docs « Application Android » (installation, mises à jour, autre
  instance, limites) et section sur la landing.

**Configuration (Logan)**

- Secrets GitHub `ANDROID_RELEASE_KEYSTORE_BASE64` et
  `ANDROID_RELEASE_KEYSTORE_PASSWORD` ; sans eux, rien n'est publié.
- Firebase : ajouter l'app Android `app.loomkeep` au projet, puis remplacer
  `ANDROID_GOOGLE_SERVICES_JSON_BASE64` par le nouveau
  `google-services.json`, qui contient les deux paquets (sans quoi le build
  release échoue).
- VPS : `ANDROID_APP_LINKS` gagne `app.loomkeep=<SHA-256 de la clé
release>`, séparé par une virgule de l'entrée debug.

**Point d'attention** : Google impose progressivement (2026-2027) que les
APK installés hors Play Store viennent de développeurs vérifiés ; la
distribution par GitHub passera alors par l'enregistrement de MOB-10.

---

## Phase 2 — iOS ⏳ plus tard

Pas prévu à court terme : la phase attend le compte Apple Developer
(99 €/an) et un environnement macOS. Les tickets restent décrits pour le
jour où elle démarre.

### MOB-11 — Projet iOS + build CI macOS + TestFlight

**Périmètre** : `cap add ios`, build simulateur sur `macos-latest`, puis
archive signée et upload TestFlight (fastlane, clé API App Store Connect en
secret). Vérifier que le pont Capacitor s'injecte aussi dans WKWebView sur
la page distante.

### MOB-12 — Push APNs (via FCM) et badge serveur

**Périmètre** : clé APNs `.p8` déposée dans Firebase, entitlement push,
même chemin d'envoi que MOB-04 ; le badge de l'icône est fixé par le
payload (nombre de non-lus), le Badging API n'existant pas dans la coque.

### MOB-13 — Universal Links et passkeys iOS

**Périmètre** : `/.well-known/apple-app-site-association` (`applinks` et
`webcredentials` pour loomkeep.app), associated domains dans l'app ;
WebAuthn testé dans WKWebView.

**Point d'attention** : sur une instance self-hostée, pas de passkeys dans
l'app (domaine non déclarable). Un compte dont le seul second facteur est
une clé de sécurité doit toujours pouvoir passer par le code email.

### MOB-14 — Dossier de review et soumission App Store

**Périmètre** : notes de review argumentant le natif (push, scan, partage),
compte de démo, labels de confidentialité, confirmation des points déjà
couverts (suppression de compte dans l'app, signalement et blocage pour le
contenu utilisateur), fiche FR/EN/IT, captures iPhone.

---

## Phase 3 — Self-host

### MOB-15 — Écran local : choix d'instance et hors ligne

**Périmètre** : page embarquée dans le binaire (`server.errorPath`) qui
s'affiche sans réseau, avec « Réessayer » ; réglage « Changer d'instance »
qui valide une URL via `GET /api/config` puis recharge la coque sur cette
instance. loomkeep.app reste la valeur par défaut.

**Point validé (#459)** : le pont Capacitor reste disponible sur une
instance choisie à l'exécution. Le Bridge calcule les origines où il
s'injecte à partir de `server.url` au moment de sa création ; `MainActivity`
lui passe donc, avant `super.onCreate`, une copie de la config embarquée
dont `server.url` vient des préférences `instance` (`InstanceConfig`).
Changer d'instance veut dire recréer l'activité. Le smoke test pointe l'app
sur une autre origine et y retrouve le pont et tous les plugins.

**Réalisé (#459)** : le choix d'instance est la vue `#pick` de
`www/error.html`, servie depuis l'APK par `ShellWebViewClient` : une fois
`server.url` fixé, Capacitor ne sert plus en local que l'URL exacte de la
page d'erreur (toute autre page locale part au réseau), et la WebView
garde le fragment dans l'URL demandée. Elle s'affiche donc même quand l'instance ne répond pas. Le plugin local
`ShellInstance` l'ouvre depuis la page de connexion (« Utiliser une autre
instance », seulement si l'APK a le plugin), la page d'erreur y mène
aussi. Une page locale n'a pas le pont Capacitor : elle répond en naviguant
vers `/_instance?use=<adresse>`, que le plugin intercepte pour interroger
`GET /api/config` (https seulement) puis enregistrer l'instance et recréer
l'activité ; `/_instance?cancel` revient à l'instance actuelle et
`/_instance` seul à loomkeep.app. La page d'erreur réessaie sur l'instance choisie.

**À traiter plus tard** (limites sur une autre instance que loomkeep.app) :

- **Liens d'email** : les App Links ne valent que pour les domaines déclarés
  dans le manifeste au build ; un lien de l'instance (vérification
  d'email, mot de passe oublié, push par email) s'ouvre donc dans le
  navigateur, pas dans l'app. Piste : un schéma `loomkeep://` que
  l'instance ajouterait à ses emails en bouton « Ouvrir dans l'app ».
- **Push natif** : l'instance ne peut pas envoyer de push à l'app publiée,
  dont les clés FCM sont celles de loomkeep.app ; c'est MOB-16.

### MOB-16 — Relais de push pour les instances self-hostées

**Problème** : les clés FCM/APNs appartiennent au binaire publié ; une
instance self-hostée ne peut pas envoyer de push natif seule.

**Périmètre** : service `push.loomkeep.app` qui reçoit `{token, payload}`
d'une instance et le transmet à FCM ; enregistrement des instances et
limitation de débit ; `PUSH_RELAY_URL` côté instance, réglable dans Admin ›
Settings.

**Décisions à prendre avant** : chiffrement de bout en bout du payload (sur
iOS, il impose une Notification Service Extension), gratuité ou offre
premium (`ee/`).

---

## Phase 4 — Natif avancé

### MOB-17 — Notifications actionnables

**Décisions (28/10/2026)** : les boutons agissent sans ouvrir l'app, avec un
jeton signé propre à la notification ; les sorties (épisodes, films, jeux)
restent sans action, puisqu'elles arrivent en récapitulatif ; Android
seulement pour l'instant.

| Notification                      | Boutons                                        |
| --------------------------------- | ---------------------------------------------- |
| Message de chat                   | Répondre (réponse directe), Marquer comme lu   |
| Demande d'abonnement              | Accepter, Refuser                              |
| Nouvel abonné                     | Suivre en retour (si ce n'est pas déjà le cas) |
| Réponse à un commentaire, mention | Répondre (réponse directe)                     |
| Suite annoncée d'une saga         | Ajouter à « À voir »                           |
| Autres entrées de la cloche       | Marquer comme lu                               |

Une action sur une entrée de la cloche la marque aussi comme lue.

**Fonctionnement**

- Android dessine lui-même les messages « notification » de FCM, sans
  boutons possibles. Un appareil qui déclare gérer les actions
  (`actions: true` à l'enregistrement de son jeton, quand l'APK a le plugin
  local `NotificationActions`) reçoit donc un message « data » : l'app
  construit la notification (canal, tag, boutons, réponse directe) dans son
  propre `FirebaseMessagingService`, qui transmet le reste au plugin push.
  Les APK plus anciens gardent le message actuel.
- Chaque bouton porte un jeton signé (HMAC) : l'action, sa cible,
  l'abonnement push et une expiration (7 jours). `POST
/api/notifications/actions`, publique, le vérifie, contrôle que
  l'abonnement existe encore pour ce compte (désactiver le push ou
  désinstaller l'app révoque donc les jetons), puis appelle le même service
  que l'action faite dans l'app, avec les mêmes contrôles (blocage, demande
  déjà traitée…).
- Le tap ouvre l'app comme aujourd'hui, avec les mêmes données : le web ne
  change pas.
- Comme le contenu, le jeton passe en clair par Google (FCM) : sa portée se
  limite à une action, sur une cible, pendant sept jours, depuis un appareil
  encore abonné.

**Découpage** : une PR API et web (jetons, route, messages « data » pour
les appareils qui les gèrent, déclaration de la capacité, sans effet tant
qu'aucun APK ne la déclare), puis une PR Android (service de messagerie,
receiver des boutons, plugin `NotificationActions`).

### MOB-18 — Partager vers Loomkeep

Android (fait) : intent-filter `SEND` texte, transformé par `SharedText.java`
en `/app/share` (le `share_target` du manifest). ⏳ iOS : Share Extension
en Swift, avec la phase 2. Cas d'usage : partager un lien IMDb, Letterboxd,
Netflix ou Spotify pour ajouter l'œuvre.

### MOB-19 — Raccourcis d'icône

Les `shortcuts` du manifest (recherche, calendrier, stats, profil,
réglages) en raccourcis Android (fait, Android 8+) ; ⏳ les quick actions
iOS restent à faire avec la phase 2.

### MOB-20 — Widgets « À suivre » et « Sorties du jour »

Glance (Kotlin) côté Android, alimenté par une route API dédiée et
rafraîchi en arrière-plan ; variante gamification (série, XP) possible.
⏳ WidgetKit (Swift) côté iOS, avec la phase 2.

### MOB-21 — Haptique et biométrie

Retour haptique sur les gains d'XP et le marquage (iOS n'a pas d'API
`vibrate`) ; Face ID / empreinte pour `@RequireRecentAuth` au lieu de
retaper le mot de passe, avec stockage Keychain/Keystore.

### MOB-22 — Exploratoire : scrobbling musical Android

Lire les sessions média Android (à la Pano Scrobbler) pour enregistrer
automatiquement les écoutes dans le domaine musique. Vérifier d'abord la
politique Play Store sur les accès aux notifications.

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
  la page de suppression (voir « Reste à faire »).
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
