# ADR 0005 — Cibles polymorphes sans clé étrangère

**Statut :** Acceptée — écrite le 26/11/2026, décision antérieure.

## Contexte

Une critique, un commentaire, un élément de liste, un signalement peut viser
des choses de natures différentes : une œuvre de l'un des quatre domaines, une
saison, un épisode, ou pour un signalement un utilisateur, une liste, un
message. Une clé étrangère SQL ne pointe que vers une seule table.

## Décision

Ces tables portent leur cible en deux colonnes, `targetType` (un enum :
`ReviewTargetType`, `CommentTargetType`, `ReportTargetType`…) et `targetId`, sans
clé étrangère. C'est le cas de `Review`, `Comment`, `CommentThreadRead`,
`MessageEmbed`, `Report`, `ModerationDecision`, `ListItem` et `ActivityEvent`.

## Conséquences

- Une seule table de critiques ou de commentaires pour tous les domaines, et un
  seul code pour les afficher, les modérer et les signaler.
- **Postgres ne garantit pas que la cible existe.** Supprimer une entrée doit
  nettoyer ce qui la visait : `polymorphicTargetCleanup()` dans
  `work/entry-lifecycle.util.ts` supprime les critiques et vide les commentaires
  de l'auteur. Un chemin de suppression qui l'oublie laisse des lignes
  orphelines que rien ne signale.
- Piste si cela devient un problème : des arcs exclusifs (une clé étrangère
  nullable par type, avec un `CHECK (num_nonnulls(...) = 1)`) pour les tables
  centrales, ou un job qui détecte les orphelins et alerte (audit
  d'architecture du 26/11/2026, API-06).
