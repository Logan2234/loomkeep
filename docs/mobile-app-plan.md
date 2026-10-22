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

| Ticket | Titre                                                  | Phase | Taille | Dépend de      | Statut            |
| ------ | ------------------------------------------------------ | ----- | ------ | -------------- | ----------------- |
| MOB-01 | Coque Capacitor Android + APK de debug en CI           | 0     | S      | —              | ✅ #433 📱        |
| MOB-02 | Intégration web ↔ natif (plateforme, retour, statut)   | 1     | M      | MOB-01         | ✅ #436           |
| MOB-03 | Icônes, splash screen et nom d'application             | 1     | S      | MOB-01         | ✅ #436 📱        |
| MOB-04 | API : push natif via FCM                               | 1     | M      | —              | ✅ #438           |
| MOB-05 | Web : enregistrement et ouverture des push natifs      | 1     | M      | MOB-02, MOB-04 | ✅ #438           |
| MOB-06 | Exports et téléchargements dans l'app                  | 1     | S      | MOB-02         | ✅ #436           |
| MOB-07 | Scan ISBN et QR natif                                  | 1     | M      | MOB-02         | ✅ #439           |
| MOB-08 | Android App Links (liens d'email et de partage)        | 1     | S      | MOB-01         | ✅ #436           |
| MOB-09 | Connexion Simkl via navigateur in-app                  | 1     | M      | MOB-08         | ✅ #447           |
| MOB-10 | Publication Android (signature, fiche, test fermé)     | 1     | M      | MOB-03, MOB-05 |                   |
| MOB-11 | Projet iOS + build CI macOS + TestFlight               | 2     | M      | MOB-02         |                   |
| MOB-12 | Push APNs (via FCM) et badge serveur                   | 2     | S      | MOB-04, MOB-11 |                   |
| MOB-13 | Universal Links et passkeys iOS                        | 2     | M      | MOB-11         |                   |
| MOB-14 | Dossier de review et soumission App Store              | 2     | M      | MOB-12, MOB-13 |                   |
| MOB-15 | Écran local : choix d'instance et hors ligne           | 3     | M      | MOB-02         |                   |
| MOB-16 | Relais de push pour les instances self-hostées         | 3     | L      | MOB-04, MOB-15 |                   |
| MOB-17 | Notifications actionnables                             | 4     | M      | MOB-05         |                   |
| MOB-18 | Partager vers Loomkeep (intent Android, extension iOS) | 4     | L      | MOB-02, MOB-11 | ✅ #447 (Android) |
| MOB-19 | Raccourcis d'icône (quick actions)                     | 4     | S      | MOB-02         | ✅ #439           |
| MOB-20 | Widgets « À suivre » et « Sorties du jour »            | 4     | L      | MOB-11         |                   |
| MOB-21 | Haptique et biométrie pour la re-confirmation          | 4     | M      | MOB-02         |                   |
| MOB-22 | Exploratoire : scrobbling musical Android              | 4     | L      | MOB-10         |                   |

Statut : ✅ = mergé dans `main`, avec le numéro de la PR qui le livre ;
📱 = validé sur téléphone (voir « Recette » plus bas).

Tailles : S ≈ une demi-journée à une journée, M ≈ deux à quatre jours,
L ≈ une semaine ou plus.

## Prérequis hors code

- Compte Google Play Console (25 $ une fois). Un compte personnel neuf
  doit passer un test fermé de **12 testeurs pendant 14 jours** avant la
  production ; un compte organisation (numéro D-U-N-S) en est exempté.
- Compte Apple Developer (99 €/an) et un iPhone de test, ou TestFlight.
- Projet Firebase (gratuit) pour FCM.
- Un environnement macOS pour iOS : runner `macos-latest` de GitHub
  Actions, Codemagic ou un Mac mini. Android se construit sur Windows
  (Android Studio) et en CI Ubuntu.
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

### MOB-19 — Raccourcis de l'icône

- [ ] Appui long sur l'icône : Recherche, Calendrier, Statistiques,
      Mon profil, Paramètres, en français.
- [ ] Chaque raccourci ouvre sa page, app fermée comme ouverte.

### MOB-09 — Simkl

- [ ] Réglages › Import › Simkl › Se connecter : Simkl s'ouvre dans un
      onglet par-dessus l'app (pas dans Chrome).
- [ ] Après « Autoriser », l'onglet se ferme et l'app affiche l'import
      Simkl, connectée ; l'import va au bout.

### MOB-18 — Partager vers Loomkeep

- [ ] Depuis IMDb, Letterboxd ou Chrome, « Partager » propose Loomkeep Dev.
- [ ] Le lien partagé ouvre la page de partage de Loomkeep sur l'œuvre (ou
      une recherche quand le lien n'est pas reconnu).

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

**Périmètre**

- Keystore de signature en secret GitHub, build `bundleRelease` (AAB) en
  CI, `versionCode` dérivé de la version lockstep.
- Fiche Play Store FR/EN/IT, captures (réutiliser les
  `pwa-screenshot-*`), politique de confidentialité (`/legal`), formulaire
  Data safety (GlitchTip, Umami), classification du contenu (social,
  contenu utilisateur).
- Test fermé (12 testeurs, 14 jours) puis production.
- Doc utilisateur dans `apps/docs`.

---

## Phase 2 — iOS

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

**Point à valider d'abord** : le pont Capacitor doit rester disponible sur
une instance choisie à l'exécution (et non fixée dans `server.url` au
build). Si ce n'est pas le cas, ce ticket redéfinit l'architecture.

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

« Marquer comme vu » sur une sortie d'épisode, réponse directe à un message
de chat, image de l'affiche dans la notification. Demande des routes API
appelables depuis l'action sans ouvrir l'app.

### MOB-18 — Partager vers Loomkeep

Android (fait) : intent-filter `SEND` texte, transformé par `SharedText.java`
en `/app/share` (le `share_target` du manifest). iOS : Share Extension en
Swift, avec la phase 2. Cas d'usage : partager un lien IMDb, Letterboxd,
Netflix ou Spotify pour ajouter l'œuvre.

### MOB-19 — Raccourcis d'icône

Les `shortcuts` du manifest (recherche, calendrier, stats, profil,
réglages) en raccourcis Android (fait, Android 8+) ; les quick actions iOS
restent à faire avec la phase 2.

### MOB-20 — Widgets « À suivre » et « Sorties du jour »

WidgetKit (Swift) et Glance (Kotlin), alimentés par une route API dédiée et
rafraîchis en arrière-plan ; variante gamification (série, XP) possible.

### MOB-21 — Haptique et biométrie

Retour haptique sur les gains d'XP et le marquage (iOS n'a pas d'API
`vibrate`) ; Face ID / empreinte pour `@RequireRecentAuth` au lieu de
retaper le mot de passe, avec stockage Keychain/Keystore.

### MOB-22 — Exploratoire : scrobbling musical Android

Lire les sessions média Android (à la Pano Scrobbler) pour enregistrer
automatiquement les écoutes dans le domaine musique. Vérifier d'abord la
politique Play Store sur les accès aux notifications.
