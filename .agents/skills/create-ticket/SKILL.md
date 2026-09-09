---
name: create-ticket
description: Use this skill whenever Logan asks to add/create a ticket on a specific Quackback board AND attach it to a roadmap in the same request — e.g. "ajoute ce ticket à ce dashboard et n'oublie pas de l'ajouter à la roadmap associée", "create this on the Bugs board", or any phrasing about creating a ticket on a board. Also trigger if only a roadmap attachment is requested for an existing post ("add this post to the roadmap"). Handles resolving board/roadmap names to IDs via Quackback:search and Quackback resources, then chains Quackback:create_post (or Quackback:triage_post for status/tags) with Quackback:manage_roadmap_post.
---

# Quackback: routage ticket → board + roadmap

## Ce que fait ce skill

Quand Logan dit un truc du type "ajoute ce ticket sur tel board", ça veut dire deux actions distinctes dans Quackback :

1. Poser le ticket ("post") sur le bon **board**.
2. Attacher ce même post à la **roadmap** associée.

## Étapes

### 1. Identifier si le ticket existe déjà ou doit être créé

- Si Logan référence un ticket qui vient d'être discuté/créé dans la conversation (ou donne un titre à créer) → **cas création**, va en étape 2.
- Si Logan référence un ticket déjà existant dans Quackback (par lien, titre à chercher, ou ID) → dis le et arrête toi là.

### 2. Cas création : nouveau ticket

1. Résous le `boardId` du board demandé : utilise `Quackback:search` (ou la resource `quackback://boards` si disponible) pour retrouver l'ID à partir du nom donné par Logan. Ne devine jamais un ID.
2. Appelle `Quackback:create_post({ boardId, title, content })` avec le titre/contenu du ticket.
3. Récupère le `postId` retourné.
4. Passe à l'étape 4 (attachement roadmap) avec ce `postId`.

### 3. Attacher à la roadmap

1. Résous le `roadmapId` de la roadmap associée. S'il n'y a pas d'ambiguïté évidente sur quelle roadmap correspond au board choisi, demande confirmation à Logan plutôt que de deviner (une roadmap n'est pas forcément 1-pour-1 avec un board).
2. Appelle `Quackback:manage_roadmap_post({ action: "add", roadmapId, postId })`.
3. Confirme à Logan en une phrase : board utilisé (ou board existant si non déplacé) + roadmap attachée, avec un lien/ID du post si disponible.

## Erreurs à éviter

- Ne jamais inventer un `boardId` ou `roadmapId` sans l'avoir résolu via recherche.
- Si `Quackback:search` retourne plusieurs boards/roadmaps proches du nom donné, demander clarification plutôt que choisir au hasard.
