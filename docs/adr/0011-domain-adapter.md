# ADR 0011 — Un adaptateur par domaine pour les modules qui les lisent tous

**Statut :** Acceptée — 27/11/2026.

## Contexte

Chaque domaine a ses propres tables ([ADR 0004](0004-one-table-set-per-domain.md)).
Mais les modules qui lisent tous les domaines à la fois (compteurs de la
bibliothèque, vue d'ensemble des stats, export du compte en JSON et en CSV)
nommaient chacun les quatre tables d'entrées, avec un `switch` ou quatre
requêtes côte à côte. Pour ajouter un domaine, il fallait passer dans chacun
d'eux, et rien ne signalait celui qu'on avait oublié.

## Décision

**Chaque module de domaine fournit un `DomainAdapter`**
(`apps/api/src/work/domain-adapter.ts`), à côté des tables qu'il possède :
`MediaDomainAdapter`, `GamesDomainAdapter`, `BooksDomainAdapter`,
`MusicDomainAdapter`. Un adaptateur répond à ce que les modules transverses
demandent à un domaine : compter les entrées d'un utilisateur, les lister sous
une forme commune (`LibraryRow`), donner le titre d'une œuvre, produire sa
part de l'export JSON et son export CSV, et nommer ses œuvres pour les avis
(`reviewTargetType`).

**`DomainRegistry` (`library/`, la façade multi-domaines) les rassemble** dans
un objet indexé par domaine dont le type exige les quatre : un domaine sans
adaptateur ne compile pas. Les modules transverses itèrent sur le registre
(`all()`, `get(domain)`, `has(domain)`) au lieu de nommer les tables.

L'adaptateur ne porte que ce qu'au moins deux modules transverses demandent,
ou ce qui doit exister pour chaque domaine. Ce qui reste propre à un domaine
(les stats détaillées du media, l'export Letterboxd des films) reste dans le
module qui l'utilise.

Premiers consommateurs : `LibraryService.getDomainCounts`, la vue d'ensemble
de `StatsService`, `DataExportService` et `CsvExportService`.

## Conséquences

- Pour ajouter un domaine, on écrit son adaptateur et on ajoute une ligne au
  registre : les compteurs, les stats d'ensemble et les deux exports le
  prennent en compte.
- Les modules des couches basses ([ADR 0010](0010-module-layers.md)) ne
  peuvent pas importer `library/` : gamification, notifications, chat,
  comments et social lisent encore les tables directement. Les autres modules
  transverses (widgets, admin, API publique, `ee/`) passeront au registre au
  fur et à mesure qu'on y touche.
- La forme de l'export d'un domaine (`<domaine>-export.types.ts`) vit
  désormais dans le module du domaine, et `account/data-export.types.ts`
  l'assemble.
