# ADR 0007 — packages/shared lu depuis ses sources par le web, compilé pour l'API

**Statut :** Acceptée — 26/11/2026 (remplace « consommé compilé, en
CommonJS », audit d'architecture du 26/11/2026, MON-02).

## Contexte

`@loomkeep/shared` porte ce que l'API et le web partagent : les DTO, les enums
calqués sur Prisma, les codes d'erreur, `ALERTS`, des règles métier exécutées
des deux côtés (niveaux, estimations, dates de sortie). L'API est un projet
NestJS en CommonJS, compilé par `tsc` et exécuté par Node ; le web et la doc
sont construits par Vite.

Le paquet était compilé en CommonJS dans `dist/`, et tout le monde lisait ce
`dist/`. Il fallait le reconstruire après chaque changement, un `dist/` en
retard faisait typer les applications contre un code qui n'existait plus, et
le web contournait le format (`optimizeDeps.include`, `commonjsOptions`,
`ssr.external`).

## Décision

Le `package.json` de shared déclare une condition d'export `source` qui pointe
sur `src/index.ts`, avant `types` et `default` qui pointent sur `dist/` :

- **le web** (Vite, ses tests Vitest, `svelte-check`, ESLint) et **la doc**
  (Astro) demandent la condition `source` (`resolve.conditions`,
  `customConditions` dans `apps/web/tsconfig.json`) : ils lisent le
  TypeScript directement, et le web l'embarque dans son build ;
- **l'API** ne la demande pas : elle lit `dist/`, en développement comme dans
  son image.

Le paquet reste en CommonJS. Le passer en ESM ne servirait plus qu'à l'API,
qui le chargerait par `require(esm)`, et obligerait à suffixer en `.js` chaque
import relatif de `src/` : aucun gain pour ce coût.

## Conséquences

- Un changement dans shared se voit aussitôt dans le web et la doc, sans
  build ni cache périmé. Les jobs CI du web et de la doc, et l'image web, ne
  compilent plus le paquet.
- L'API, elle, garde la règle : `pnpm build:package` après un changement
  (automatique sous `pnpm dev`) avant de la typer ou de la lancer.
- Le web type les sources de shared avec ses propres options
  (`verbatimModuleSyntax`) : shared active `isolatedModules` pour qu'un type
  ré-exporté sans `export type` échoue déjà dans son propre `check`.
