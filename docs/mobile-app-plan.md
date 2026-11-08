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

Livré : MOB-01 à MOB-09, MOB-15, MOB-17, MOB-20, MOB-21, MOB-23, MOB-24,
MOB-25, et la partie Android de MOB-18 et MOB-19. MOB-01, MOB-03, MOB-09 et
MOB-20 sont validés sur téléphone ; le reste attend la fin de sa recette.

Hors tickets : l'audit visuel Android passe avant MOB-10 (#492, #501, #504),
et le clavier a été corrigé (#498, #499).

| Ticket | Titre                                          | Taille | Dépend de      | Statut                     |
| ------ | ---------------------------------------------- | ------ | -------------- | -------------------------- |
| MOB-10 | Publication sur Google Play                    | M      | audit visuel   | 🚧 reste le compte et Play |
| MOB-16 | Relais de push pour les instances self-hostées | L      | —              | décisions à prendre        |
| MOB-22 | Exploratoire : scrobbling musical Android      | L      | MOB-10         |                            |
| MOB-11 | Projet iOS + build CI macOS + TestFlight       | M      | —              | ⏳ plus tard               |
| MOB-12 | Push APNs (via FCM) et badge serveur           | S      | MOB-11         | ⏳ plus tard               |
| MOB-13 | Universal Links et passkeys iOS                | M      | MOB-11         | ⏳ plus tard               |
| MOB-14 | Dossier de review et soumission App Store      | M      | MOB-12, MOB-13 | ⏳ plus tard               |

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

### Push natif (MOB-04, MOB-05)

- [ ] Paramètres Android › Loomkeep Dev › Notifications : six canaux
      (Activité, Sorties, Compte, Sécurité, Admin, Annonces) en français.
- [ ] Message de chat reçu sans Loomkeep ouvert nulle part : notification,
      et le tap ouvre la conversation.
- [ ] Une notification de la cloche ouverte depuis le push est marquée lue.

### Exports et partage (MOB-06)

- [ ] Export de migration : les fichiers s'enchaînent, une feuille après
      l'autre.

### Scan natif (MOB-07)

- [ ] Dos d'un livre : la recherche passe en mode ISBN avec le code.
- [ ] Code-barres d'un produit : « Ce code-barres n'est pas l'ISBN d'un
      livre ».
- [ ] Profil › scanner : le QR d'un autre profil l'ouvre ; un autre QR est
      refusé avec un message.

### Choix d'instance (MOB-15)

- [ ] Une vraie instance self-hostée : l'app redémarre dessus, on peut s'y
      connecter, et elle reste choisie après avoir fermé l'app.

### Notifications actionnables (MOB-17)

- [ ] Mode avion puis un bouton : la notification reste et dit que
      l'action a échoué ; le tap ouvre toujours la bonne page.

### Partage et raccourcis (MOB-18, MOB-19)

- [ ] Depuis IMDb, Letterboxd ou Chrome, « Partager » propose Loomkeep Dev.
- [ ] Le lien partagé ouvre la page de partage de Loomkeep sur l'œuvre (ou
      une recherche quand le lien n'est pas reconnu).
- [ ] Appui long sur l'icône : Recherche, Calendrier, Statistiques,
      Mon profil, Paramètres, en français ; chaque raccourci ouvre sa page,
      app fermée comme ouverte.

### Ouvrir une autre instance dans l'app (MOB-24)

Les clients mail retirent les liens `loomkeep://` : l'email garde son lien
https, et c'est la page, ouverte dans le navigateur, qui propose l'app.

- [ ] Sur une instance self-hostée, Chrome sur Android, page de
      réinitialisation reçue par mail : le bandeau « Ouvrir » ouvre l'app sur
      cette page. Le fermer ne le remontre plus.
- [ ] Sur une autre instance que celle de l'app : il demande avant de changer ;
      « Annuler » reste sur l'instance actuelle.
- [ ] Absent sur loomkeep.app, sur le site public et dans l'app.

### Verrouillage (MOB-25)

- [ ] Réglages › Sécurité › Verrouiller l'app : activer et désactiver demandent
      l'empreinte ou le code ; annuler ne change rien.
- [ ] Activé : demandé en lançant l'app et en revenant après plus d'une minute,
      pas avant. L'empreinte comme le code déverrouillent.
- [ ] Annuler laisse l'écran verrouillé, sans le contenu, avec « Déverrouiller ».
- [ ] Android 13+ : pas d'aperçu du contenu dans les apps récentes.
- [ ] Sans verrouillage d'écran : le réglage est grisé et l'explique.

### Haptique et passkey proposée (MOB-21)

- [ ] Petite vibration en marquant un épisode, une saison ou un film, depuis
      la fiche ou l'accueil, et à l'appui long dans la bibliothèque ;
      vibration plus marquée avec une bulle de succès ou de niveau. Les
      vibrations de `@capacitor/haptics` ne se sentaient pas sur un Poco X5
      Pro : à revérifier depuis le plugin local de la #498.
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
- Captures téléphone d'au moins 1080 px de large et au plus 2:1 (les
  `pwa-screenshot-*-mobile.jpg`, 375 × 811, ne passent pas) : celles du
  Poco (1080 × 2400) recadrées en 1080 × 2160. L'icône et la bannière sont
  dans `apps/mobile/store/`, avec leur source HTML (rendue par Chrome sans
  interface, à la taille exacte).
- Adresse de suppression de compte à donner à Play :
  https://docs.loomkeep.app/guide/your-data/#if-you-cant-sign-in-anymore
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

### MOB-22 — Exploratoire : scrobbling musical

Lire les sessions média Android (à la Pano Scrobbler) pour enregistrer
automatiquement les écoutes dans le domaine musique. Vérifier d'abord la
politique Play sur l'accès aux notifications.

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
> Ton historique reste à toi : importe-le depuis TV Time, Trakt, Simkl,
> MyAnimeList, AniList, Letterboxd, IMDb, Steam, Goodreads, StoryGraph ou
> Babelio, et exporte-le en entier quand tu veux. Gratuit, sans publicité.
>
> • Suivi précis : saisons, épisodes, relectures, parties en cours,
> abandonnées ou terminées, avec les dates de chaque séance.
> • Calendrier des sorties : les prochains épisodes, films et jeux de ce
> que tu suis, et un flux à ajouter à ton agenda.
> • Statistiques : ton année en séries, films, jeux, livres et musique.
> • Entre amis : profils, avis, listes partagées et messages.
>
> L'application ajoute les notifications Android (nouveaux épisodes,
> réponses, messages), le scan du code-barres d'un livre ou du QR code
> d'un ami, le partage d'un lien IMDb ou Letterboxd vers Loomkeep, et des
> raccourcis sur son icône.
>
> Loomkeep est un logiciel libre (AGPL) : tu peux aussi héberger ta propre
> instance et y connecter l'application.

**Description longue — EN**

> Loomkeep keeps track of everything you watch, play, read and listen to:
> series and anime episode by episode, films and rewatches, games with
> their playtime, books page by page, albums. One library and one stats
> page, instead of one app per passion.
>
> Your history stays yours: bring it from TV Time, Trakt, Simkl,
> MyAnimeList, AniList, Letterboxd, IMDb, Steam, Goodreads, StoryGraph or
> Babelio, and export all of it whenever you like. Free, no ads.
>
> • Precise tracking: seasons, episodes, rereads, games in progress,
> dropped or finished, with the date of every session.
> • Release calendar: upcoming episodes, films and games from what you
> follow, and a feed for your own calendar.
> • Stats: your year in series, films, games, books and music.
> • With friends: profiles, reviews, shared lists and messages.
>
> The app adds Android notifications (new episodes, replies, messages),
> scanning a book's barcode or a friend's QR code, sharing an IMDb or
> Letterboxd link to Loomkeep, and shortcuts on its icon.
>
> Loomkeep is free software (AGPL): you can also host your own instance and
> connect the app to it.

**Description longue — IT**

> Loomkeep tiene traccia di tutto ciò che guardi, giochi, leggi e ascolti:
> serie e anime episodio per episodio, film e nuove visioni, giochi con il
> tempo di gioco, libri pagina per pagina, album. Una sola libreria e una
> sola pagina di statistiche, invece di un'app per ogni passione.
>
> La tua cronologia resta tua: importala da TV Time, Trakt, Simkl,
> MyAnimeList, AniList, Letterboxd, IMDb, Steam, Goodreads, StoryGraph o
> Babelio, ed esportala per intero quando vuoi. Gratis, senza pubblicità.
>
> • Tracciamento preciso: stagioni, episodi, riletture, giochi in corso,
> abbandonati o finiti, con la data di ogni sessione.
> • Calendario delle uscite: i prossimi episodi, film e giochi di ciò che
> segui, e un feed da aggiungere al tuo calendario.
> • Statistiche: il tuo anno in serie, film, giochi, libri e musica.
> • Con gli amici: profili, recensioni, liste condivise e messaggi.
>
> L'app aggiunge le notifiche Android (nuovi episodi, risposte, messaggi),
> la scansione del codice a barre di un libro o del QR di un amico, la
> condivisione di un link IMDb o Letterboxd verso Loomkeep, e scorciatoie
> sulla sua icona.
>
> Loomkeep è software libero (AGPL): puoi anche ospitare la tua istanza e
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
