# Politique de confidentialité

_Brouillon — à faire relire avant publication (idéalement par quelqu'un de
compétent en RGPD). Dernière mise à jour : 09/08/2026._

Cette politique s'applique à l'instance publique de Loomkeep hébergée à
<loomkeep.app>. Si tu utilises une instance self-host installée par un tiers,
c'est cette personne qui est responsable du traitement de tes données —
cette politique ne couvre que l'instance officielle.

## 1. Responsable de traitement

Logan WILLEM, contact : <contact@loomkeep.app>. Voir aussi les
[mentions légales](./mentions-legales.md).

## 2. Données collectées

| Donnée | Finalité | Champ / source |
|---|---|---|
| Email | Création de compte, connexion, envoi d'emails transactionnels | `User.email` |
| Mot de passe | Authentification (haché avec bcrypt, jamais stocké en clair) | `User.passwordHash` |
| Pseudo, avatar, bio | Affichage du profil public | `User.*` |
| Historique de visionnage/lecture, notes, avis, commentaires | Cœur du service (suivi de consommation media) | `EpisodeWatch`, `Review`, `Comment`, etc. |
| Relations (abonnements/amis) | Fonctionnalités sociales | `Follow` |
| Abonnement notifications push | Envoi de notifications | endpoint de souscription navigateur (`PushSubscription`) |
| Préférence de langue/thème | Personnalisation de l'interface | `User.locale`, préférences locales |
| Adresse IP (transitoire) | Sécurité, logs techniques, débogage | logs applicatifs, reverse proxy |
| Erreurs techniques (stack traces) | Diagnostic de bugs | GlitchTip (auto-hébergé, aucune donnée envoyée à un tiers externe) |

Nous ne collectons **aucune donnée de paiement** (pas de fonctionnalité
payante actuellement) et **aucun cookie de tracking/publicitaire** : les
jetons de connexion sont stockés en `localStorage` sur ton appareil, pas
dans un cookie.

## 3. Finalités et bases légales

- **Fourniture du service** (compte, suivi, fonctions sociales) : exécution
  du contrat (les CGU que tu acceptes à l'inscription).
- **Sécurité et modération** (logs, traitement des signalements) : intérêt
  légitime.
- **Notifications push** et **newsletter nouveautés** : consentement
  explicite, révocable à tout moment depuis les réglages.
- **Emails transactionnels** (vérification de compte, réinitialisation de
  mot de passe) : exécution du contrat, nécessaires au fonctionnement du
  compte.

## 4. Destinataires et sous-traitants

- **OVHcloud** — hébergement du serveur et de la base de données (France).
- **Brevo** — envoi des emails transactionnels et de la newsletter
  (société française, hébergement UE).
- **TMDB, AniList, IGDB, MusicBrainz** — fournisseurs des catalogues
  media/jeux/musique interrogés côté serveur pour la recherche et les
  fiches ; aucune donnée personnelle identifiante n'est transmise à ces
  services (les requêtes portent sur des titres d'œuvres, pas sur ton
  compte).
- **GlitchTip** — auto-hébergé sur notre propre infrastructure, aucune
  donnée ne quitte donc nos serveurs pour ce point.

Aucune donnée n'est vendue ni partagée à des fins publicitaires.

## 5. Durée de conservation

- **Compte actif** : les données sont conservées tant que le compte existe.
- **Suppression de compte** : suppression immédiate.
- **Sauvegardes** : les sauvegardes quotidiennes de la base de données sont
  conservées 7 jours glissants.
- **Logs techniques** : [à compléter — durée de rétention actuelle des logs
  applicatifs/reverse proxy].

## 6. Tes droits

Conformément au RGPD, tu disposes d'un droit d'accès, de rectification,
d'effacement, de limitation, d'opposition et de portabilité de tes données.

- La plupart de ces droits sont exerçables directement depuis
  **Réglages** : modification du profil, export de tes données, suppression
  de compte.
- Pour toute autre demande : <contact@loomkeep.app>.
- Tu peux également introduire une réclamation auprès de la CNIL
  (<www.cnil.fr>) si tu estimes que tes droits ne sont pas respectés.

## 7. Sécurité

Les mots de passe sont hachés (bcrypt), les échanges chiffrés en HTTPS, et
l'authentification repose sur des jetons JWT à courte durée de vie avec
rotation des jetons de rafraîchissement.

## 8. Modifications

Cette politique peut évoluer ; toute modification substantielle sera
annoncée via le changelog du produit et/ou par email aux utilisateurs
inscrits à la newsletter.
