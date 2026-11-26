# ADR 0007 — packages/shared consommé compilé, en CommonJS

**Statut :** Acceptée — écrite le 26/11/2026, décision antérieure. Peut être
revue (audit d'architecture du 26/11/2026, MON-02).

## Contexte

`@loomkeep/shared` porte ce que l'API et le web partagent : les DTO, les enums
calqués sur Prisma, les codes d'erreur, `ALERTS`, des règles métier exécutées
des deux côtés (XP, niveaux, estimations). L'API est un projet NestJS en
CommonJS (`"type": "commonjs"`), le web un projet SvelteKit en ESM.

## Décision

Le paquet est compilé par `tsc` en CommonJS dans `dist/`, et les deux
applications importent ce `dist/` (`main` et `exports` y pointent).

## Conséquences

- L'API le charge comme n'importe quel paquet CommonJS, dans le conteneur comme
  en développement.
- Il faut reconstruire le paquet après chaque changement (`pnpm build:package`,
  automatique sous `pnpm dev`) : un `dist/` en retard fait typer les
  applications contre un code qui n'existe plus.
- Le web contourne le format : `optimizeDeps.include`, `commonjsOptions` et
  `ssr.external` dans `apps/web/vite.config.ts`, et `--force` en dev pour ne
  pas servir un pré-bundle périmé.
- Piste : une condition d'export `source` pointant sur `src/` pour le
  développement et le web, en gardant `dist/` pour l'image de l'API.
