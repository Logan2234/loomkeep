# ADR 0009 — L'app Android est une coque qui charge l'instance

**Statut :** Acceptée — écrite le 26/11/2026, décision antérieure. Le détail
vit dans `docs/mobile-app-plan.md`.

## Contexte

Capacitor permet d'embarquer le front dans l'APK ou de faire afficher par
l'APK une URL distante.

## Décision

**Coque distante** : l'app affiche le `/app` de l'instance choisie
(loomkeep.app par défaut, une autre instance à l'exécution, MOB-15) au lieu
d'embarquer le web.

## Conséquences

- Web et API restent synchrones : une PR web arrive sur les téléphones au
  déploiement, seul un changement dans `apps/mobile` demande un nouvel APK.
  L'API interne ne devient pas un contrat public figé à la version d'un APK.
- Les cookies d'authentification (`SameSite=Strict`) restent ceux du site :
  pas de second transport d'authentification, ce qu'un web servi depuis
  `https://localhost` aurait imposé.
- Un APK installé peut avoir plusieurs versions de retard sur le web : le web
  n'appelle un plugin natif qu'après `Capacitor.isPluginAvailable()`, et ne
  l'importe que depuis `apps/web/src/lib/native/` (ESLint). Un plugin s'ajoute
  à la même version dans `apps/web` et `apps/mobile`.
- Sans réseau, l'app montre une page hors ligne au lieu de l'application.
