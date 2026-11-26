# ADR 0004 — Un jeu de tables par domaine

**Statut :** Acceptée — écrite le 26/11/2026, décision antérieure.

## Contexte

Les quatre domaines (media, jeux, livres, musique) ont chacun un catalogue et
une bibliothèque. On aurait pu n'avoir qu'une table `Item` et une table `Entry`
polymorphes, avec une colonne `domain` et des champs optionnels.

## Décision

**Des tables par domaine** : `MediaItem`/`MediaEntry`, `GameItem`/`GameEntry`,
`BookItem`/`BookEntry`, `MusicItem`/`MusicEntry`, chacune avec ses statuts et
ses champs propres (saisons et épisodes, sessions et parties, lectures et
éditions…), et ses tables filles.

## Conséquences

- Chaque table garde des contraintes réelles : colonnes `NOT NULL`, enums de
  statut propres au domaine, clés étrangères vers ses propres tables filles.
- Ce que les domaines partagent doit être écrit une fois et tenu aligné : le
  code commun vit dans `apps/api/src/work/` (cycle de vie d'une entrée, prêts,
  édition en masse, liens), et `work/domain-parity.spec.ts` vérifie chaque
  comportement que les quatre doivent avoir.
- Les modules transverses (stats, export, admin, widgets, API publique)
  interrogent les quatre tables. Ajouter un domaine veut dire passer dans chacun
  d'eux ; un adaptateur de domaine commun réduirait ce coût (audit
  d'architecture du 26/11/2026, API-05).
