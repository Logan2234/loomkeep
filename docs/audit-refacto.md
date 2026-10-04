# Audit de refactoring — monorepo Loomkeep

> Audit en lecture seule réalisé le 2026-10-04 sur `main` @ `bbb3c9a1` (v1.10.0).
> Périmètre : `apps/api/src`, `apps/web/src`, `packages/shared/src`, configs racine.
> Exclus : `apps/web/src/lib/paraglide` et `apps/web/src/lib/api/generated` (générés), contenu d'`apps/docs`.
> Chaque piste cite des fichiers et lignes relus. `≈` = numéro à ±2 lignes.
> Les pistes marquées 🐛 sont des **défauts déjà présents**, révélés par une duplication qui a divergé : selon le CLAUDE.md, chacune demande un test de régression rouge avant correction.

---

## 1. Résumé exécutif

- **Base saine** : `common/entry-lifecycle.util.ts`, `common/http.util.ts` (`fetchJson`), `lib/format.ts`, `Modal`/`ConfirmationModal` et les helpers TanStack sont bien adoptés. Il n'y a aucun `any` en production API, aucun `@ts-ignore`, et la config ESLint/tsconfig est factorisée.
- **La dette vient surtout de copies qui ont divergé.** Ces divergences ont déjà produit **plusieurs bugs réels** :
  - liens `/games/…` sans préfixe `/app` dans les listes et les stats ;
  - plafond du minuteur absent côté web ;
  - « S1E2 » contre « S01E02 ».
- **Plus gros gisement front ↔ back** : les **limites de champs** (environ 15 paires `@MaxLength` ↔ `maxlength` codées en dur) et les **constructeurs de routes `/app/...`** (environ 55 sites des deux côtés). Ces deux familles vont naturellement dans `packages/shared`, sur le modèle de `REVIEW_TEXT_MAX_LENGTH`.
- **À l'inverse, `packages/shared` est surdimensionné côté API** : `dto/api-v1.ts` (21/21 exports API seule), `dto/data-export.ts` (37/38) et environ 270 exports sur 546 ne sont jamais importés par le web, qui type ces routes via OpenAPI. Une règle d'appartenance est à acter.
- **Plus gros gains en lignes** :
  - docks de session jeu/livre (environ 1 800 lignes dupliquées à environ 85 %) ;
  - 3 panneaux de recherche quasi identiques ;
  - 5 modals de mot de passe dans `MfaSection` ;
  - le `switch` à 4 domaines répété 6 fois dans `admin-cache.controller.ts` ;
  - les 11 boutons « charger plus ».
- **Fichiers à découper en priorité** : `library.service.ts` (2163 l.), `mail.service.ts` (1929), `achievements/registry.ts` (1677), `data-export.service.ts` (une méthode de 746 l.), `LibraryBrowser.svelte` (1062), `CommentThread.svelte` (1025).
- **Inventaire total** : 220 pistes, dont 13 marquées 🐛 (1 classée P0, les autres P1/P2 selon la gravité) et des quick wins (S, faible risque).

---

## 2. Cartographie constatée

```
loomkeep/                       pnpm workspace (apps/*, packages/*), Node ≥22, TS ^6.0.3 (racine seule)
├── apps/api        NestJS 12 + Fastify + Prisma 7 (PostgreSQL) — CJS — 669 fichiers .ts hors spec, ≈64,6 k lignes
│   └── src/<domaine>/          36 domaines : admin, api-keys, auth, books, catalog, comments, common, config, ee,
│                               entitlements, events, feature-flags, games, gamification, health, import,
│                               instance-settings, jobs, library, links, lists, mail, metrics, music, newsletter,
│                               notifications, prisma, public-api, reports, reviews, saved-views, security,
│                               session-timer, social, stats, users
│       ├── <x>.controller.ts / <x>.service.ts / <x>.module.ts / dto/ (1 DTO par fichier) / providers/
│       ├── common/             69 fichiers *.util.ts (aucun *.utils.ts ni helpers/) — pagination, http, dates,
│       │                       entry-lifecycle, work-href, prisma-error, parse-enum-param…
│       └── ee/                 code sous LICENSE-EE (le core ne l'importe jamais — règle ESLint)
├── apps/web        SvelteKit 2 + Svelte 5 + TanStack Query + Tailwind 4 + Paraglide — ESM — ≈69 k lignes
│   └── src/
│       ├── lib/                76 fichiers à plat + sous-dossiers actions/, api/ (wrappers par domaine, core.ts,
│       │                       client.ts barrel, keys.ts, query/mutation helpers), components/ (≈120 composants à
│       │                       plat + home/, profile/, search/, sidebars/, stats/, onboarding/), constants/, types/,
│       │                       home/, gamification/, realtime/, ee/, test/
│       └── routes/             site public prérendu (/, legal/) + /app (SPA, ssr=false) + (auth)/(verification)
├── apps/docs       Astro Starlight + Scalar (lit openapi-v1.json ; importe shared par chemin relatif)
└── packages/shared @loomkeep/shared — CJS, build tsc → dist/, barrel unique index.ts (50 `export *`) — ≈7,7 k lignes
    └── src/                    enums.ts (858 l.), error-codes.ts, alerts.ts, xp-rules.ts, level.ts, password.ts,
                                validation-constraints.ts, movie-release.ts, runtime.ts, realtime.ts, locale.ts…
                                dto/ (36 fichiers : admin.ts 618 l., data-export.ts 497, import.ts, stats.ts…)
```

**Conventions observées** :

- Côté API, une règle « un DTO par fichier ». Les classes `*ResponseDto` font `implements` de l'interface shared correspondante, et un spec le verrouille.
- Les enums sont des objets `as const`, en miroir des enums Prisma. On caste aux frontières, par conception.
- Le web type ses appels via `typedRequest` et les types OpenAPI générés. Il importe de shared surtout les enums et les constantes.
- La config est factorisée : `eslint.config.base.mjs` et `tsconfig.base.json`.

---

## 3. Tableau récapitulatif

**Légende** :

- **Impact** : faible / moyen / fort.
- **Effort** : S (< ½ j), M (½–2 j), L (> 2 j).
- **Risque** : faible / moyen / élevé.
- **Priorité** : P0 = bug révélé, à corriger d'abord avec un test rouge ; P1 = fort rendement ; P2 = utile ; P3 = opportuniste.

**Préfixes d'ID** :

| Préfixe            | Axe | Périmètre                           |
| ------------------ | --- | ----------------------------------- |
| `SH`               | 1   | partagé front + back                |
| `HB` / `HF`        | 2   | helpers back / front                |
| `CB` / `CF`        | 3   | constantes back / front             |
| `TB` / `TF`        | 4   | types back / front                  |
| `RB` / `RF` / `RT` | 5   | refactors back / front / transverse |

| ID    | Axe | Titre                                                                                               | Impact | Effort | Risque | Priorité |
| ----- | --- | --------------------------------------------------------------------------------------------------- | ------ | ------ | ------ | -------- |
| SH-01 | 1   | `MAX_SESSION_DURATION_MINUTES` redéclarée côté web                                                  | faible | S      | faible | P1       |
| SH-02 | 1   | Longueurs de mot de passe 8/72 en dur (API + web)                                                   | moyen  | S      | faible | P1       |
| SH-03 | 1   | ≈15 limites de champs texte en miroir `@MaxLength` ↔ `maxlength`                                    | fort   | M      | faible | P1       |
| SH-04 | 1   | Échelle de note 0–10 et histogramme divergent (10 vs 11 cases)                                      | moyen  | M      | moyen  | P2       |
| SH-05 | 1   | 🐛 Constructeurs de routes `/app/...` (≈55 sites) → `shared/routes.ts`                              | fort   | M      | faible | P0       |
| SH-06 | 1   | 🐛 Code épisode `SxxEyy` ×7, « S1E2 » dans les notifications                                        | moyen  | S      | faible | P1       |
| SH-07 | 1   | Pourcentage de progression série ×4                                                                 | faible | S      | faible | P2       |
| SH-08 | 1   | 🐛 Pourcentage de lecture livre ×4, variantes divergentes (borne)                                   | moyen  | S      | faible | P1       |
| SH-09 | 1   | Statuts synthétiques DORMANT/GHOST/PAUSED en littéraux                                              | moyen  | S      | faible | P2       |
| SH-10 | 1   | Clés de tri des bibliothèques : unions API privées, `sort?: string` web                             | moyen  | M      | faible | P2       |
| SH-11 | 1   | Union `"asc" \| "desc"` ×11                                                                         | faible | S      | faible | P2       |
| SH-12 | 1   | Unions shared sans tableau runtime, re-épelées en `@IsIn`                                           | moyen  | S      | faible | P2       |
| SH-13 | 1   | Sous-ensembles de `ReportStatus` en littéraux                                                       | faible | S      | faible | P3       |
| SH-14 | 1   | `ModerationReasonBody` déclaré des deux côtés                                                       | faible | S      | faible | P2       |
| SH-15 | 1   | 🐛 Realtime : `jobId` absent d'`ImportProgressEvent`, commandes de salle en littéraux               | moyen  | S      | faible | P1       |
| SH-16 | 1   | Noms de flags Unleash (`premium-features`, `MAINTENANCE_*`) en chaînes                              | moyen  | S      | faible | P2       |
| SH-17 | 1   | Longueurs OTP (6) et code de secours (10)                                                           | faible | S      | faible | P2       |
| SH-18 | 1   | Avatar : types MIME et dimension 512 en double/triple                                               | faible | S      | faible | P2       |
| SH-19 | 1   | Bornes des raccourcis de la barre mobile (3..7, `menu`)                                             | faible | S      | faible | P3       |
| SH-20 | 1   | Seuil d'expiration des clés API (7 j) badge ↔ mail                                                  | faible | S      | faible | P3       |
| SH-21 | 1   | Construction de la portée `${resource}:read` ×3                                                     | faible | S      | faible | P3       |
| SH-22 | 1   | Règle « film à venir » réimplémentée côté web                                                       | moyen  | S      | faible | P2       |
| SH-23 | 1   | Somme du temps restant d'une série en double                                                        | faible | S      | faible | P3       |
| SH-24 | 1   | 🐛 Arrondi minuteur → minutes sans plafond côté web                                                 | faible | S      | faible | P1       |
| SH-25 | 1   | Domaines « à session » `GAMES \| BOOKS` répétés                                                     | faible | S      | faible | P3       |
| SH-26 | 1   | Correspondance type de critique → domaine                                                           | faible | S      | faible | P3       |
| SH-27 | 1   | 🐛 Normalisation sans accents ×6 ; filtre serveur et import non normalisés                          | moyen  | S      | faible | P1       |
| SH-28 | 1   | Objectif de lecture 1..1000                                                                         | faible | S      | faible | P3       |
| SH-29 | 1   | Jour local `YYYY-MM-DD` : regex de contrat et fabrication de la clé                                 | moyen  | S      | faible | P2       |
| SH-30 | 1   | `DEFAULT_PAGE_SIZE` recopié côté web                                                                | faible | S      | faible | P3       |
| SH-31 | 1   | Union `"push" \| "email"` ×6                                                                        | faible | S      | faible | P3       |
| SH-32 | 1   | 23 classes `*Body` sur 28 n'implémentent pas le DTO de requête shared                               | moyen  | M      | faible | P2       |
| SH-33 | 1   | `dto/api-v1.ts` utilisé par l'API seule → `public-api/v1`                                           | moyen  | S      | faible | P2       |
| SH-34 | 1   | `dto/data-export.ts` : 37/38 exports API seule                                                      | moyen  | M      | faible | P2       |
| SH-35 | 1   | Petits fichiers shared API seule + règle d'appartenance à acter                                     | moyen  | M      | faible | P2       |
| SH-36 | 1   | `COMMENT_EMOTE_DISPLAY` web seul → web                                                              | faible | S      | faible | P3       |
| SH-37 | 1   | `entryStatusFromProgress` API seule → `import/`                                                     | faible | S      | faible | P3       |
| SH-38 | 1   | `XP_RULES` / `XP_RULE_LIST` (API seule, export spéculatif)                                          | faible | S      | faible | P3       |
| SH-39 | 1   | `DEFAULT_INSTANCE_SETTINGS` / `INSTANCE_SETTING_ENV` API seule                                      | faible | S      | faible | P3       |
| SH-40 | 1   | `mergeAlertPrefs` API seule                                                                         | faible | S      | faible | P3       |
| HB-01 | 2   | `sleep` dupliqué entre HTTP et throttle                                                             | faible | S      | faible | P2       |
| HB-03 | 2   | 🐛 8 `fetch` bruts sans timeout (dont Turnstile au login)                                           | moyen  | S      | faible | P1       |
| HB-04 | 2   | User-Agent identifiant construit ×3                                                                 | faible | S      | faible | P3       |
| HB-05 | 2   | 🐛 Parsing de `WEB_ORIGIN` réécrit ×8 (`//app` dans les flux ICS/RSS)                               | moyen  | S      | faible | P1       |
| HB-06 | 2   | `startOfUtcDay` ×3, `startOfUtcMonth`                                                               | faible | S      | faible | P2       |
| HB-07 | 2   | Intervalles d'année/mois UTC ×4                                                                     | faible | S      | faible | P3       |
| HB-08 | 2   | « il y a N jours » inliné ≈15 fois (`sinceDaysAgo` existe)                                          | moyen  | S      | faible | P2       |
| HB-09 | 2   | Repli `localDay(...) ?? toISOString().slice(0,10)` ×6                                               | faible | S      | faible | P2       |
| HB-10 | 2   | Clé `YYYY-MM-DD` redéclarée ×4 + inlinée ×7                                                         | faible | S      | faible | P3       |
| HB-11 | 2   | Import : `toDateOrNull` (collision de nom), `earliest` copiés                                       | faible | S      | faible | P3       |
| HB-12 | 2   | Date UTC des CSV livres ×2                                                                          | faible | S      | faible | P3       |
| HB-13 | 2   | 🐛 Validation ISBN ×3 (babelio accepte `x` minuscule)                                               | faible | S      | faible | P2       |
| HB-14 | 2   | Import : `indexPlanMatches` et `toMatch` copiés                                                     | faible | S      | faible | P3       |
| HB-15 | 2   | `normalizeSessionNotes` / `validDate` copiés jeux ↔ livres                                          | faible | S      | faible | P2       |
| HB-16 | 2   | `stripHtml` ×2                                                                                      | faible | S      | faible | P3       |
| HB-17 | 2   | Idiome `take: limit + 1` / `hasMore` ≈15 sites                                                      | moyen  | M      | faible | P2       |
| HB-18 | 2   | `(page - 1) * limit` recalculé alors que `ParsedPage.skip` existe                                   | faible | S      | faible | P3       |
| HB-20 | 2   | Résolution des cibles d'œuvres dupliquée (lists/reviews/export/stats)                               | fort   | M      | moyen  | P1       |
| HB-21 | 2   | Objet `select` canonique des external ids ×14                                                       | faible | S      | faible | P2       |
| HB-22 | 2   | P2002 inline ×4 malgré `isUniqueViolation`                                                          | faible | S      | faible | P2       |
| HB-23 | 2   | SHA-256 hex ×3 (couplage users → auth.service)                                                      | faible | S      | faible | P2       |
| HB-24 | 2   | Tokens aléatoires `randomBytes(...)` ×8                                                             | faible | S      | faible | P3       |
| HB-25 | 2   | Code OTP à 6 chiffres ×3                                                                            | faible | S      | faible | P3       |
| HB-26 | 2   | Émission de tokens à usage unique ×3 dans `auth.service`                                            | moyen  | S      | faible | P2       |
| HB-27 | 2   | `parseTarget` / `domainOrThrow` réimplémentent `parseEnumParam`                                     | faible | S      | faible | P3       |
| HB-28 | 2   | URLs d'images TMDB ×9 / IGDB ×3                                                                     | faible | S      | faible | P3       |
| HB-29 | 2   | Regroupement par spread en O(n²) ×2                                                                 | faible | S      | faible | P3       |
| HB-30 | 2   | Requête « ids d'épisodes vus » ×5 dans `library.service`                                            | faible | S      | faible | P2       |
| HB-31 | 2   | Stubs de test dupliqués (`stubXp` ×9, `mockFetchByUrl` ×6…)                                         | moyen  | M      | faible | P2       |
| HF-02 | 2   | `sessionStorage` sans try/catch (onboarding)                                                        | faible | S      | faible | P3       |
| HF-03 | 2   | Retour « copié » ×8 (timers non nettoyés, rejet non géré)                                           | moyen  | S      | faible | P1       |
| HF-05 | 2   | `DAY_MS` / différence de jours calendaires ×8                                                       | faible | S      | faible | P2       |
| HF-06 | 2   | Horodatage des noms de fichiers téléchargés ×5                                                      | faible | S      | faible | P3       |
| HF-07 | 2   | Helpers coincés dans `home/widgets/media.ts` mais réécrits ≈30 fois                                 | moyen  | S      | faible | P1       |
| HF-08 | 2   | Pluriel à la main ≈60 sites, règle incohérente (`> 1` vs `=== 1`)                                   | fort   | L      | moyen  | P2       |
| HF-09 | 2   | Pourcentages formatés à la main malgré `formatNumber`                                               | faible | S      | faible | P3       |
| HF-10 | 2   | Formatage de nombre et de langue hors `format.ts`                                                   | faible | S      | faible | P3       |
| HF-11 | 2   | Durées et horloges formatées à la main, `formatSessionMinutes` non localisé                         | moyen  | S      | faible | P2       |
| HF-12 | 2   | Debounce manuel dans `UserSelector`                                                                 | faible | S      | faible | P3       |
| HF-13 | 2   | Compte à rebours manuel au lieu de `Cooldown` ×2                                                    | faible | S      | faible | P3       |
| HF-14 | 2   | Déconnexion + redirection ×5, `profileHref` ×3                                                      | faible | S      | faible | P2       |
| HF-15 | 2   | Libellés → options réécrits ×8 (`pick` existe)                                                      | faible | S      | faible | P3       |
| HF-16 | 2   | `compact()` duplique le filtre de `joinMeta`                                                        | faible | S      | faible | P3       |
| HF-17 | 2   | Comparateurs de listes ×2 (clés différentes)                                                        | faible | S      | faible | P3       |
| HF-18 | 2   | `localeCompare` sans collation cohérente ×5                                                         | faible | S      | faible | P3       |
| HF-19 | 2   | Paramètres d'URL énumérés validés à la main ×5                                                      | faible | S      | faible | P2       |
| HF-20 | 2   | Sérialisation `page`/`limit` ×18 dans `lib/api`                                                     | faible | S      | faible | P2       |
| CB-01 | 3   | `MINUTE/HOUR/DAY_MS` redéfinis ≈35 fois (API + web + shared)                                        | moyen  | S      | faible | P2       |
| CB-02 | 3   | TTL de synchro catalogue 24 h ×6 + commentaire périmé                                               | moyen  | S      | faible | P1       |
| CB-03 | 3   | Durées de vie access/refresh définies deux fois (JWT ↔ cookie)                                      | moyen  | S      | faible | P1       |
| CB-04 | 3   | Presets `@Throttle` répétés (×5, ×3, ×6)                                                            | faible | S      | faible | P2       |
| CB-05 | 3   | En-têtes de rate limit listés ×3 (CORS)                                                             | faible | S      | faible | P2       |
| CB-06 | 3   | URLs de base des providers redupliquées dans les sondes admin                                       | faible | S      | faible | P3       |
| CB-07 | 3   | Adresse de support / origine Quackback en dur                                                       | faible | S      | faible | P3       |
| CB-08 | 3   | Styles de cron mélangés                                                                             | faible | S      | faible | P3       |
| CB-09 | 3   | `REPORT_PAGE_SIZE` = `DEFAULT_PAGE_SIZE`, `take: 50` ×2                                             | faible | S      | faible | P3       |
| CF-01 | 3   | Clés de stockage éparpillées (3 conventions de préfixe)                                             | moyen  | S      | faible | P2       |
| CF-02 | 3   | Debounce de recherche 300 ms ×10                                                                    | faible | S      | faible | P2       |
| CF-03 | 3   | 171 durées de transition, 16 valeurs distinctes                                                     | moyen  | L      | moyen  | P3       |
| CF-04 | 3   | Media queries en dur + `matchMedia` manuel                                                          | faible | S      | faible | P3       |
| CF-05 | 3   | `limit={10}` de la recherche intégrée ×4                                                            | faible | S      | faible | P3       |
| CF-06 | 3   | URL feedback en dur malgré `external-links.ts`                                                      | faible | S      | faible | P3       |
| CF-07 | 3   | Domaine → page bibliothèque mappé ×3 (+ nav)                                                        | moyen  | S      | faible | P2       |
| CF-08 | 3   | Libellé/icône/teinte de domaine re-déclarés (6 fichiers)                                            | moyen  | S      | faible | P1       |
| CF-09 | 3   | Libellé/teinte par `ReviewTargetType` dupliqués                                                     | faible | S      | faible | P2       |
| CF-10 | 3   | 🐛 Libellés `MediaType` ×10, libellé anime incohérent                                               | moyen  | S      | faible | P1       |
| CF-11 | 3   | Libellés de liste (genre, visibilité) ×4                                                            | faible | S      | faible | P2       |
| CF-12 | 3   | Options de tri communes aux 4 bibliothèques                                                         | faible | S      | faible | P3       |
| CF-13 | 3   | Options de statut média réécrites (`MEDIA_STATUS_META` existe)                                      | faible | S      | faible | P3       |
| CF-14 | 3   | Placeholder `"—"` ×21                                                                               | faible | S      | faible | P3       |
| TB-01 | 4   | `as unknown as` sur `homeLayout` et `instance-settings`                                             | faible | S      | faible | P2       |
| TB-02 | 4   | `alertPrefs as AlertPrefs` ×4                                                                       | faible | S      | faible | P2       |
| TB-03 | 4   | Colonnes JSON castées ×11                                                                           | faible | S      | faible | P3       |
| TB-04 | 4   | `toPlaythroughDto` / `toReadingDto` dupliqués et typés à la main                                    | moyen  | S      | faible | P1       |
| TB-05 | 4   | `!` après `filter` (prédicats de type manquants) ×14                                                | faible | S      | faible | P3       |
| TB-06 | 4   | `dto.listId!` dans des closures ×4                                                                  | faible | S      | faible | P3       |
| TB-07 | 4   | `!` sur un token relu après `update` ×2                                                             | faible | S      | faible | P3       |
| TB-08 | 4   | `!` sur des variables d'env (push)                                                                  | faible | S      | faible | P3       |
| TB-09 | 4   | `Map.get(...)!` ×9                                                                                  | faible | S      | faible | P3       |
| TB-10 | 4   | Cast du dictionnaire de quotas                                                                      | faible | S      | faible | P3       |
| TF-01 | 4   | `IconName` redéclaré ×3                                                                             | faible | S      | faible | P3       |
| TF-02 | 4   | Type option `{ value; label }` ≈20 fois                                                             | moyen  | S      | faible | P2       |
| TF-03 | 4   | Points de graphique dupliqués ×4                                                                    | faible | S      | faible | P3       |
| TF-04 | 4   | `ListTile` dupliqué                                                                                 | faible | S      | faible | P3       |
| TF-05 | 4   | `ActivityKind` dupliqué                                                                             | faible | S      | faible | P3       |
| TF-06 | 4   | `BannerVariant` redéclaré                                                                           | faible | S      | faible | P3       |
| TF-07 | 4   | `"ALL" \| StatsDomain` dupliqué                                                                     | faible | S      | faible | P3       |
| TF-08 | 4   | 🐛 `FeatureBadgeKey` affaibli en `string` (faute de frappe silencieuse)                             | moyen  | S      | faible | P1       |
| TF-09 | 4   | ≈20 casts `as Domain` dus à `Object.keys(DOMAINS)`                                                  | faible | S      | faible | P2       |
| TF-10 | 4   | `Object.fromEntries(...) as Record` ×8                                                              | faible | S      | faible | P3       |
| TF-11 | 4   | `Record<string, …>` sur des clés typées                                                             | faible | S      | faible | P3       |
| TF-12 | 4   | `quick-add.ts` : 8 casts `raw as XDetail`                                                           | faible | M      | moyen  | P3       |
| TF-13 | 4   | `ImportSourceDescriptor` ment (7 casts sur les sources « bientôt »)                                 | moyen  | S      | faible | P2       |
| TF-14 | 4   | `$props()` non typés (3 composants + 10 layouts)                                                    | faible | S      | faible | P3       |
| RB-03 | 5   | `ownedEntry` / `ownedSession` contournent `assertEntryOwnership`                                    | moyen  | S      | faible | P2       |
| RB-04 | 5   | Bloc XP de fin de cycle copié ×4                                                                    | moyen  | M      | moyen  | P2       |
| RB-05 | 5   | Tables cycle → statut d'entrée                                                                      | faible | S      | faible | P3       |
| RB-06 | 5   | Nettoyage XP des `deleteEntry` ×4                                                                   | moyen  | M      | moyen  | P3       |
| RB-07 | 5   | Filtre PAUSED/dormant identique jeux ↔ livres                                                       | faible | S      | faible | P2       |
| RB-08 | 5   | Double lecture dans `getEntry`/`updateEntry` (×4 domaines)                                          | moyen  | S      | faible | P2       |
| RB-09 | 5   | Services `*-item` clones (TTL, `canonicalExternalId` réimplémenté)                                  | moyen  | S      | faible | P2       |
| RB-10 | 5   | Découper `library.service.ts` (2163 l.) en 5 services                                               | fort   | L      | moyen  | P1       |
| RB-11 | 5   | `computeProgress` duplique `computeProgressBatch`                                                   | moyen  | S      | faible | P2       |
| RB-12 | 5   | Lecture de `watchRegion` dupliquée                                                                  | faible | S      | faible | P3       |
| RB-13 | 5   | `markUnwatched` mal nommé (marque _vus_)                                                            | faible | S      | faible | P2       |
| RB-14 | 5   | `admin-cache.controller` : `switch` ×6 et 28 appels Prisma → service à registre                     | fort   | M      | moyen  | P1       |
| RB-15 | 5   | `takeDown` réimplémente `decide` → `ModerationActionService`                                        | moyen  | M      | moyen  | P2       |
| RB-16 | 5   | `admin-users.controller` porte le métier → `AdminUsersService`                                      | moyen  | M      | faible | P2       |
| RB-17 | 5   | Petits contrôleurs admin avec agrégats Prisma                                                       | faible | S      | faible | P3       |
| RB-18 | 5   | Résolution « profil visible ou 404 » ×9                                                             | moyen  | S      | faible | P1       |
| RB-19 | 5   | `domainGate.assertEnabled` ×34 → `@RequireDomain`                                                   | moyen  | M      | moyen  | P2       |
| RB-20 | 5   | Découper `mail.service.ts` (1929 l.)                                                                | moyen  | M      | faible | P2       |
| RB-21 | 5   | Découper `mail.i18n.ts` (1208 l.) par langue                                                        | moyen  | S      | faible | P2       |
| RB-22 | 5   | Découper `achievements/registry.ts` (1677 l.)                                                       | moyen  | M      | faible | P2       |
| RB-23 | 5   | Découper `list.service.ts` (1121 l.)                                                                | moyen  | M      | faible | P3       |
| RB-24 | 5   | Découper `comment.service.ts` (1123 l.)                                                             | moyen  | M      | faible | P3       |
| RB-25 | 5   | Découper `auth.service.ts` (1174 l.)                                                                | moyen  | L      | moyen  | P3       |
| RB-26 | 5   | Découper `users.service.ts` (891 l.)                                                                | moyen  | M      | faible | P3       |
| RB-27 | 5   | `data-export.buildExport` : une méthode de 746 lignes                                               | moyen  | M      | faible | P2       |
| RB-28 | 5   | Sortir `RatingService` / `ReviewVoteService` de `review.service.ts`                                 | moyen  | M      | moyen  | P3       |
| RB-29 | 5   | `stats.service` : 4 `fetch*Rows` quasi identiques                                                   | moyen  | M      | faible | P3       |
| RB-30 | 5   | `public-api/v1/dto/responses.dto.ts` (871 l.) à découper                                            | faible | S      | faible | P3       |
| RF-01 | 5   | Docks de session jeu/livre dupliqués (≈1 800 l.)                                                    | fort   | L      | moyen  | P1       |
| RF-02 | 5   | Coque commune des pages détail                                                                      | fort   | M      | moyen  | P1       |
| RF-03 | 5   | Bloc avis/commentaires ×3 (+ `canParticipate` constant)                                             | faible | S      | faible | P2       |
| RF-04 | 5   | Notes externes : balisage ×3 et `RATING_STYLES` ×3                                                  | moyen  | S      | faible | P2       |
| RF-05 | 5   | Carte « Détails » ×3                                                                                | faible | S      | faible | P3       |
| RF-06 | 5   | Correction de statut identique jeux/livres                                                          | moyen  | S      | faible | P2       |
| RF-07 | 5   | Galerie/lightbox ×3                                                                                 | faible | S      | faible | P3       |
| RF-09 | 5   | Widgets Resume/ToWatch : erreurs avalées, `busy` manuel                                             | faible | S      | faible | P2       |
| RF-10 | 5   | `ImportWizard.runSearch` / `CommentMentionInput` / pseudo : requêtes manuelles                      | faible | S      | faible | P3       |
| RF-11 | 5   | Clés de requête hors `keys.ts`                                                                      | faible | S      | faible | P2       |
| RF-12 | 5   | `LoadMoreButton` : 11 copies, 2 libellés                                                            | moyen  | S      | faible | P1       |
| RF-13 | 5   | Action `use:inView` ×3                                                                              | faible | S      | faible | P3       |
| RF-14 | 5   | Squelettes KPI ×5 pages admin                                                                       | faible | S      | faible | P3       |
| RF-15 | 5   | Pastille de statut admin ×12 → classe `.pill`                                                       | faible | S      | faible | P3       |
| RF-16 | 5   | `AvatarLightbox` réimplémente `Lightbox` (focus non piégé)                                          | moyen  | S      | faible | P2       |
| RF-17 | 5   | Page de recherche : dropdown et onglets sans ARIA                                                   | moyen  | M      | faible | P2       |
| RF-18 | 5   | 3 panneaux de recherche identiques à ≈90 %                                                          | fort   | M      | faible | P1       |
| RF-19 | 5   | Champs de déclaration de modération ×2                                                              | faible | S      | faible | P3       |
| RF-20 | 5   | Classe d'input brute au lieu de `.input`                                                            | faible | S      | faible | P3       |
| RF-21 | 5   | 5 modals de confirmation par mot de passe dans `MfaSection`                                         | moyen  | S      | faible | P1       |
| RF-22 | 5   | `SettingsLinkRow` ×3 / `EmptyState` refait ×2                                                       | faible | S      | faible | P3       |
| RF-23 | 5   | 🐛 `<img>` brut sans repli 404 au lieu de `Poster` ×4                                               | faible | S      | faible | P2       |
| RF-24 | 5   | Logique de progression des épisodes dans les composants                                             | moyen  | S      | faible | P2       |
| RF-25 | 5   | `ImportWizard` (830 l.) : logique à extraire                                                        | moyen  | M      | faible | P2       |
| RF-26 | 5   | Synchronisation d'édition sur la page livre (effet → mutation)                                      | faible | S      | faible | P3       |
| RF-27 | 5   | `UserDrawer` : 5 `switch` d'aiguillage → table                                                      | faible | S      | faible | P3       |
| RF-28 | 5   | Découper `LibraryBrowser.svelte` (1062 l.)                                                          | moyen  | M      | moyen  | P2       |
| RF-29 | 5   | Découper `CommentThread.svelte` (1025 l.)                                                           | moyen  | M      | moyen  | P3       |
| RF-30 | 5   | Découper `MfaSection.svelte` (945 l.)                                                               | moyen  | S      | faible | P2       |
| RF-31 | 5   | Divers découpages faibles (landing, search, drawers admin, navigation.ts, api/admin.ts, indicateur) | faible | M      | faible | P3       |
| RT-01 | 5   | Code mort : `extractMentions`, `gameSessionAggregate`, `canAccessProfile`, `shareOrNull`            | faible | S      | faible | P1       |
| RT-02 | 5   | Spec orphelin `gamification/level.util.spec.ts`                                                     | faible | S      | faible | P1       |
| RT-03 | 5   | Script `graph` cassé + dépendance `tsconfig-paths` inutile                                          | faible | S      | faible | P1       |
| RT-04 | 5   | Champs d'import hérités (`subtitle`, `sub`) + chaînes FR/EN en dur côté API                         | moyen  | S      | faible | P2       |
| RT-05 | 5   | Shims de compatibilité à dater (`LegacyBackupFileDto`, `loomkeep.tokens`)                           | faible | S      | faible | P3       |
| RT-06 | 5   | `make-zip.ts` (helper de test) compilé dans `dist/`                                                 | faible | S      | faible | P2       |
| RT-07 | 5   | Barrel `lib/api/client.ts` (118 imports) : statut à trancher                                        | moyen  | M      | faible | P2       |
| RT-08 | 5   | Libs navigateur dans les `dependencies` web (image Docker)                                          | moyen  | S      | moyen  | P2       |
| RT-09 | 5   | `@simplewebauthn/browser` en devDependency de shared                                                | faible | S      | faible | P2       |
| RT-10 | 5   | `apps/docs` hors du lockstep de version (1.9.0)                                                     | faible | S      | faible | P2       |
| RT-11 | 5   | ≈75 entrées obsolètes dans `minimumReleaseAgeExclude`                                               | faible | S      | faible | P2       |
| RT-12 | 5   | knip `ignoreDependencies: ["rxjs"]` mal placé                                                       | faible | S      | faible | P3       |
| RT-13 | 5   | Configs vitest dupliquées + couverture shared incluant les specs                                    | faible | S      | faible | P3       |
| RT-14 | 5   | Sévérité `no-unused-vars` différente web ↔ base                                                     | faible | S      | faible | P3       |
| RT-15 | 5   | Style de test API incohérent (globals vs imports)                                                   | faible | S      | faible | P3       |
| RT-16 | 5   | Fichiers camelCase dans le web (6)                                                                  | faible | S      | faible | P3       |
| RT-17 | 5   | `apps/web/src/lib/` : 76 fichiers à plat → sous-dossiers                                            | moyen  | M      | moyen  | P3       |
| RT-18 | 5   | `lib/components/` : ≈120 composants à plat + modules `.ts`                                          | moyen  | M      | moyen  | P3       |
| RT-19 | 5   | `lib/domains.ts` vs `lib/constants/domains.ts`                                                      | faible | S      | faible | P3       |
| RT-20 | 5   | Nommage des parseurs d'import incohérent ; CSV dispersé                                             | faible | S      | faible | P3       |
| RT-21 | 5   | Specs « par fonctionnalité » sans fichier source correspondant                                      | faible | S      | faible | P3       |
| RT-22 | 5   | Exports inutiles (48 API, 19 web)                                                                   | faible | S      | faible | P3       |
| RT-23 | 5   | `shared/enums.ts` (858 l.) mélange enums, constantes et logique report                              | moyen  | S      | faible | P2       |
| RT-24 | 5   | `Locale` défini dans `enums.ts` alors que `locale.ts` existe                                        | faible | S      | faible | P3       |
| RT-25 | 5   | `shared/dto/admin.ts` (618 l.) mélange 8 sous-domaines                                              | faible | S      | faible | P3       |
| RT-26 | 5   | Commentaires faux ou orphelins (liste)                                                              | faible | S      | faible | P2       |
| RT-27 | 5   | `apps/docs` importe shared par chemin relatif profond ; Dockerfiles                                 | faible | S      | faible | P3       |
| RT-28 | 5   | 🐛 `detectLocale` ignore l'italien                                                                  | faible | S      | faible | P1       |

**Total : 227 pistes**, dont 20 marquées 🐛. Par priorité : 8 P0, 31 P1, 83 P2 et 105 P3.

| Axe                | Nombre de pistes                      |
| ------------------ | ------------------------------------- |
| Axe 1 (partagé)    | 40                                    |
| Axe 2 (helpers)    | 51 (31 back, 20 front)                |
| Axe 3 (constantes) | 23 (9 back, 14 front)                 |
| Axe 4 (types)      | 24 (10 back, 14 front)                |
| Axe 5 (refactors)  | 89 (30 back, 31 front, 28 transverse) |

---

## 4. Détail par axe

### Axe 1 — Code partagé front + back → `packages/shared`

**Contraintes générales du package** :

- shared est compilé en **CommonJS**, avec un barrel unique.
- Vite tree-shake mal le CJS : toute donnée runtime ajoutée part probablement dans le bundle web. Pour des constantes et petites fonctions pures, le coût est négligeable ; pour de gros objets réservés à l'API (`XP_RULES`, `ALERTS`), il ne l'est pas.
- Aucune proposition ci-dessous n'importe de module Node ni Prisma.
- Chaque changement exige `pnpm build:package`.

#### SH-01 — `MAX_SESSION_DURATION_MINUTES` redéclarée côté web

- **Constat** :
  - `packages/shared/src/dto/session.ts:4` et `apps/web/src/lib/session-presentation.ts:1` déclarent la même constante, `= 9999`.
  - Côté web, les 3 consommateurs importent la copie locale : `BookSessionDock.svelte:16-21`, `GameSessionDock.svelte:16-21` et `SessionDurationPicker.svelte:3-6`.
- **Proposition** : supprimer la ligne web et importer depuis `@loomkeep/shared`.
- **Bénéfice** : c'est le doublon le plus net de l'audit.
- **Risque** : nul.

#### SH-02 — Longueurs de mot de passe 8/72

- **Constat** :
  - API : `@MinLength(8) @MaxLength(72)` dans `auth/dto/register.dto.ts:29-30`, `auth/dto/reset-password.dto.ts:15-16` et `users/dto/change-password.dto.ts:16-17`.
  - Web : `minlength={8} maxlength={72}` dans `routes/(auth)/register/+page.svelte:184-185`, `reset-password/+page.svelte:61-62,72-73` et `settings/components/SecuritySection.svelte:555-556,571-572`.
  - `PASSWORD_MIN_LENGTH` existe déjà dans `password.ts`, mais seul `PasswordRequirements.svelte` le lit.
- **Proposition** :
  - ajouter `PASSWORD_MAX_LENGTH = 72` dans `packages/shared/src/password.ts`, en y déplaçant le commentaire sur la troncature bcrypt (`register.dto.ts:28`) ;
  - utiliser les deux constantes partout.
- **Risque** : nul.

#### SH-03 — Limites de longueur des champs texte

Le modèle existe déjà (`REVIEW_TEXT_MAX_LENGTH`, `COMMENT_TEXT_MAX_LENGTH`, `API_KEY_NAME_MAX_LENGTH`, `HOME_LAYOUT_LIMITS`). Voici les paires codées en dur :

| Champ                        | Limite    | API (`apps/api/src/`)                                                                                              | Web (`apps/web/src/`)                                                                       | Cible shared                                  |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Nom affiché                  | 50        | `auth/dto/register.dto.ts:44`, `users/dto/update-user.dto.ts:41`, `reports/dto/profile-measures.dto.ts:29`         | `EditProfileModal.svelte:50`, `register/+page.svelte:141`, `admin/reports/+page.svelte:710` | `USER_LIMITS.displayName` (`dto/user.ts`)     |
| Nom d'utilisateur            | 50        | `users/dto/update-username.dto.ts:7`                                                                               | `SecuritySection.svelte:377`                                                                | `USER_LIMITS.username`                        |
| Bio                          | 500       | `update-user.dto.ts:97`                                                                                            | `EditProfileModal.svelte:61`                                                                | `USER_LIMITS.bio`                             |
| Notes d'entrée               | 5000      | 8 DTO `upsert-/update-*-entry.dto.ts` (library:27/40, books:32/37, games:32/36, music:31/36)                       | `NoteField.svelte:22`                                                                       | `ENTRY_NOTES_MAX_LENGTH` (`dto/library.ts`)   |
| Notes de session             | 1000      | `create-/update-book-session.dto.ts:28`, `create-/update-game-session.dto.ts:28`, `finish-session-timer.dto.ts:22` | `BookSessionDock.svelte:735,907`, `GameSessionDock.svelte:596,720`                          | `SESSION_NOTES_MAX_LENGTH` (`dto/session.ts`) |
| `ownershipSource`            | 100       | `common/dto/bulk-entries.dto.ts:44` + 4 `update-*-entry.dto.ts`                                                    | `OwnershipMenuItems.svelte:67`                                                              | `OWNERSHIP_SOURCE_MAX_LENGTH`                 |
| Titre / description de liste | 100 / 500 | `lists/dto/create-list.dto.ts:18,23`, `update-list.dto.ts:19,24`                                                   | `ListFormModal.svelte:135,153`                                                              | `LIST_LIMITS` (`dto/list.ts`)                 |
| Motif de signalement         | 500       | `reports/dto/create-report.dto.ts:19`                                                                              | `ReportModal.svelte:223`                                                                    | `REPORT_REASON_MAX_LENGTH`                    |
| Push admin (titre / corps)   | 100 / 500 | `admin/dto/send-admin-broadcast-push.dto.ts:7,12`, `send-admin-test-push.dto.ts:10,15`                             | `PushTab.svelte:165,180,276,291`                                                            | `PUSH_LIMITS` (`dto/push.ts`)                 |
| Libellé d'invitation         | 60        | `admin/dto/create-admin-invitation.dto.ts:28`                                                                      | `InviteUserModal.svelte:279`                                                                | à côté de `INVITATION_MAX_USES`               |
| Nom de clé WebAuthn          | 60        | `users/dto/rename-webauthn-credential.dto.ts:7`                                                                    | `MfaSection.svelte:720,759`                                                                 | `WEBAUTHN_NAME_MAX_LENGTH`                    |

- **Bénéfice** : aucune dérive possible entre ce qu'accepte l'input et ce que valide l'API.
- **Piège** : `AddToListModal.svelte:181` (`maxlength={100}`) borne une **recherche**, pas un titre. C'est un faux positif.
- **Risque** : nul.

#### SH-04 — Échelle de note et histogramme

- **Constat** :
  - La note est bornée par `@Min(0) @Max(10)` dans 9 DTO (`library/dto/update-entry.dto.ts:21-22`, …, `reviews/dto/upsert-review.dto.ts:21-22`). Côté web, l'échelle 0–10 est en dur dans `RatingSlider.svelte:18,84-85`, `rating-words.ts:21`, `review-draft.ts:27` et `review-community.ts:27`.
  - **Divergence** : `apps/api/src/stats/rating-distribution.util.ts:11-18` range les notes dans **10 cases (1..10)** et ramène la note 0 dans la case 1. `apps/web/src/lib/review-community.ts:27-41` utilise **11 cases (0..10)**.
  - La moyenne est arrondie à une décimale côté API, pas côté web.
- **Proposition** : ajouter `RATING_MIN` et `RATING_MAX` dans `dto/review.ts`, et éventuellement des fonctions pures `ratingDistribution()` et `averageRating()`.
- **Risque** : moyen. Il faut d'abord **trancher le sort de la note 0**, car la réponse change soit `RatingBucketDto`, soit le graphique web.

#### SH-05 — 🐛 Constructeurs de chemins `/app/...` → `packages/shared/src/routes.ts`

- **Constat, bug** : deux copies ont perdu le préfixe `/app`.
  - `apps/api/src/lists/list.service.ts:1111-1120` (`detailHref`) renvoie `` `/${domain}/${sourceId}` `` pour games, books et music.
  - `apps/api/src/stats/stats.service.ts:279-296` (`itemHref`/`mediaHref`) renvoie `` `/${prefix}/…` `` pour **tous** les domaines.
  - Or le web n'a aucune route `/games` ni `/media` à la racine, ni de redirection dans `hooks.server.ts`. Ces liens donnent donc une 404 dans :
    - `routes/app/lists/[id]/+page.svelte:258-259,453-454` ;
    - `lib/components/home/widgets/ListContentWidget.svelte:47` ;
    - `StatsWorksModal.svelte:45` ;
    - `VideoStatsSection.svelte:168,183`.
- **Copies correctes** (le chemin est construit à la main environ 25 fois côté API) :
  - `common/work-href.util.ts:30,41,51,61`
  - `reviews/review.service.ts:659-668`
  - `stats/home-stats.service.ts:279-295`
  - `social/activity.service.ts:407-449`
  - `admin/admin-cache.controller.ts:246,277,302,327`
  - `links/link-resolver.service.ts:28-40,109-112`
  - `notifications/notification.service.ts:60,314`
  - `public-api/v1/mappers.ts:46,67,87,107`
  - `ee/calendar/calendar-feed.service.ts:111`
- **Côté web**, environ 30 sites :
  - `mediaHref` dans `lib/components/home/widgets/media.ts:6`, réécrit dans `SavedViewWidget.svelte:54`, `MediaSearchPanel.svelte:190`, `calendar/+page.svelte:163-164`, `media/+page.svelte:75-76`, `media/[type]/[id]/+page.svelte:784,795` et `CastSection.svelte:183` ;
  - `` `/app/games|books|music/${…}` `` dans `FavoritesWidget.svelte:60,74,88`, `SavedViewWidget.svelte:63,72,81`, les widgets Books/Games/Music, les 3 `*SearchPanel`, et `routes/app/{books,games,music}/+page.svelte` ;
  - le parsing inverse dans `lib/quick-add.ts:42-43`.
- **Proposition** :
  - créer `packages/shared/src/routes.ts`, avec `mediaPath(type, sourceId)`, `workPath(domain, sourceId)`, `profilePath(username)` et `listPath(id)` ;
  - optionnellement, `parseWorkPath(href)` pour quick-add.
- **Bénéfice** :
  - le bug disparaît par construction ;
  - la consigne du CLAUDE.md « grep `/app/` avant de renommer une route » se réduit à un seul fichier.
- **Pourquoi c'est légitime dans shared** : l'API émet réellement ces chemins (push, mails, flux). Ce n'est pas un couplage artificiel.
- **Risque** : nul, ce sont des chaînes pures.
- **Ordre** : écrire d'abord le test rouge sur `ListService.resolveTargets` et `StatsService`.

#### SH-06 — 🐛 Code épisode `SxxEyy`

- **Constat** :
  - API : `ee/calendar/ics.util.ts:59`, `ee/calendar/calendar-feed.service.ts:104` et `notifications/notification.service.ts:55`. Cette dernière écrit **« S1E2 »**, sans zéro devant, alors que tout le reste utilise « S01E02 ».
  - Web : `epCode` dans `home/widgets/media.ts:3`, réécrit dans `calendar/+page.svelte:162`, `ActionBar.svelte:92-94,101-103` et `EpisodesSection.svelte:399-401,446,457`.
- **Proposition** : `episodeCode(season, episode)` dans shared (`dto/library.ts` ou un nouveau `format.ts`).
- **Risque** : le texte des notifications push change, ce qui est voulu.

#### SH-07 — Pourcentage de progression d'une série

- **Constat** : `apps/api/src/library/library.service.ts:165-170` (`mediaProgressPct`), web `home/widgets/media.ts:9-14` (`entryPct`), `routes/app/media/+page.svelte:≈62-67` et `media/[type]/[id]/+page.svelte:275-281`.
- **Proposition** : `progressPercent(progress: ProgressDto | null)` dans `dto/library.ts`.
- **Risque** : nul.

#### SH-08 — 🐛 Pourcentage de lecture d'un livre : 4 variantes

- **Constat** :
  - API `books/book-library.service.ts:168-170` : ratio sans borne et sans ×100.
  - Web `routes/app/books/+page.svelte:45-51` : borné, et `READ` donne 100.
  - `home/widgets/BooksReadingWidget.svelte:38-41` : **sans borne**, donc plus de 100 % si la page courante dépasse le total.
  - `BookSessionDock.svelte:127-134` : borné, sur une autre base.
- **Proposition** : `bookProgressPercent(currentPage, pageCount, status?)` dans `dto/book.ts`.
- **Risque** : faible. Il faut choisir la sémantique et aligner le tri « progress » de l'API.

#### SH-09 — Statuts synthétiques de filtre

- **Constat** :
  - API : `library/library.service.ts:131,639-643`, `saved-views/saved-view.service.ts:22` (`[...Object.values(EntryStatus), "DORMANT", "GHOST"]`), `books/book-library.service.ts:508,516` et `games/game-library.service.ts:479,487`.
  - Web : `routes/app/media/+page.svelte:42-43`, `books/+page.svelte:41`, `games/+page.svelte:39`, `ResumeWidget.svelte:26` et `lib/api/library.ts:16-17` (`statuses?: string[]`).
- **Proposition** :
  - ajouter `MEDIA_FILTER_STATUSES` en `as const`, `SESSION_FILTER_PAUSED`, ainsi que les types `MediaFilterStatus`, `GameFilterStatus` et `BookFilterStatus` ;
  - dans l'API, réutiliser `DORMANT_AFTER_DAYS` × `DAY_MS` (voir CB-01) au lieu du `* 24*60*60*1000` de `book-library:518` et `game-library:489`.
- **Risque** : nul.

#### SH-10 — Clés de tri des bibliothèques

- **Constat** :
  - API, unions privées : `library.service.ts:102-120`, `book-library.service.ts:94-114`, `game-library.service.ts:92-102` et `music-library.service.ts:69-78`.
  - Web, chaînes libres : `SORTS` dans `routes/app/{media,books,games,music}/+page.svelte` et `home/widgets/sorts.ts:8-11`.
  - Les filtres `List*Filters` de `lib/api/{library,books,games,music}.ts` sont quasi identiques, tous avec `sort?: string`.
- **Proposition** : `MEDIA_SORT_KEYS`, `BOOK_SORT_KEYS`, `GAME_SORT_KEYS` et `MUSIC_SORT_KEYS` en `as const` dans `dto/<domaine>.ts`, utilisés pour typer les `SORTS` côté web.
- **Risque** : nul.

#### SH-11 — `SortOrder`

- **Constat** : l'union `"asc" | "desc"` apparaît dans `shared/dto/saved-view.ts:24`, `common/entry-lifecycle.util.ts:38`, `public-api/v1/dto/queries.dto.ts:98-99`, `library-v1.service.ts:50`, `saved-views/dto/saved-view.dto.ts:59-60,127`, `lib/api/{books,games,library,music}.ts` et `LibraryBrowser.svelte:9`.
- **Proposition** : `SORT_ORDERS` en `as const` et `type SortOrder` dans `dto/pagination.ts`.

#### SH-12 — Unions shared sans tableau runtime

| Union (shared)                                         | Copies                                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `StatsWindow` `dto/stats.ts:59`                        | `stats/stats.controller.ts:39`, web `PeriodFilter.svelte:9`                                    |
| `WatchStaleness` `dto/stats.ts:150`                    | `stats.controller.ts:38`                                                                       |
| `TrendPeriod` `dto/admin.ts:217`                       | `admin/admin-stats.controller.ts:27`                                                           |
| `AdminUserFilter` `dto/admin.ts:408`                   | `admin-users.controller.ts:77-83`, web `admin/users/+page.svelte:82-87`                        |
| `LeaderboardScope/Period` `dto/gamification.ts:97,104` | `social/leaderboard/dto/leaderboard-query.dto.ts:6,10`, `users/dto/home-layout.dto.ts:135,143` |
| `HomeQuickLink.kind` `dto/home-layout.ts:66`           | `users/dto/home-layout.dto.ts:43-44`                                                           |
| `AdminCacheSort` `dto/admin.ts:264`                    | `admin-cache.controller.ts:106` (cast **sans validation**)                                     |

- **Proposition** : suivre le modèle déjà en place pour `STATS_DOMAINS` (`const X = [...] as const; type X = (typeof X)[number]`), puis utiliser `@IsIn(X)` côté API.

#### SH-13 — `ReportResolution`

- **Constat** : `reports/dto/resolve-report.dto.ts:4-5` (`@IsIn(["RESOLVED","DISMISSED"])`), `report.service.ts:263,286,299`, `admin-reports.controller.ts:56,92`, web `lib/api/admin.ts:443` et `admin/reports/+page.svelte:107`.
- **Proposition** : `type ReportResolution = Exclude<ReportStatus,"PENDING">` et `REPORT_RESOLUTIONS` dans `dto/report.ts`.

#### SH-14 — `ModerationReasonBody` dupliqué

- **Constat** : classe API `reports/dto/moderation-reason.dto.ts:10-26`, interface web `lib/api/admin.ts:26-30` (utilisée l.283, 454, 465, 476 et 487).
- **Proposition** : `ModerationReasonRequestDto` dans `dto/report.ts`, que la classe API `implements`.

#### SH-15 — 🐛 Contrat realtime incomplet

- **Constat** :
  - L'API émet `{ jobId, done, total, status }` (`import/import-job.service.ts:483-488`), mais `ImportProgressEvent` (`shared/realtime.ts`) **n'a pas de `jobId`**, d'où le contournement `ImportProgressEvent & { jobId: string }` dans `ImportWizard.svelte:147`. L'union de statut est dupliquée dans `import-job.service.ts:50`.
  - Les commandes de salle `"join-comments" | "leave-comments" | "join-list" | "leave-list"` sont des littéraux côté API (`events/events.gateway.ts:220,236,250,260`) et côté web (`lib/realtime/socket.ts:85-86`, `CommentsPanel.svelte:69`, `routes/app/lists/[id]/+page.svelte:57`).
  - 18 appels `emitToUser(…, "notification" | …)` passent un littéral plutôt que `RealtimeEvent.X` : `library.service.ts:300,780`, `book-library:344,638`, `game-library:312,604`, `music-library:235,475`, etc.
- **Proposition** : dans `realtime.ts`, ajouter `jobId`, un `RealtimeCommand` en `as const`, `ImportJobStatus` et, en option, une map `RealtimePayloads` pour typer `emitToUser`.
- **Risque** : nul.

#### SH-16 — Noms de flags Unleash

- **Constat** :
  - `"premium-features"` côté API (`entitlements/entitlement.service.ts:73`, `ee/licensing/license.service.ts:49`, `api-keys/api-rate-limit.service.ts:97`) et côté web (`lib/auth.svelte.ts:28`).
  - `` `MAINTENANCE_${domain}` `` côté API (`users/domain-gate.service.ts:50`) et côté web (`lib/domains.ts:28`, `routes/app/settings/domains/+page.svelte:108`).
- **Proposition** : `packages/shared/src/feature-flags.ts` avec `FeatureFlag` en `as const` et `maintenanceFlag(domain)`.

#### SH-17 — Longueurs des codes à usage unique

- **Constat** :
  - API : `auth/mfa.service.ts:17,64`, `auth.service.ts:408,462`, `users/users.service.ts:465`, `confirm-totp.dto.ts:6` et `confirm-email-change.dto.ts:6`.
  - Web : `login/+page.svelte:375` (`11 : 6`), `MfaSection.svelte:587,594` et `SecuritySection.svelte:493,500`.
- **Proposition** : `OTP_CODE_LENGTH` et `RECOVERY_CODE_LENGTH` dans `dto/auth.ts`. L'alphabet des codes reste privé à l'API.

#### SH-18 — Avatar

- **Constat** :
  - Types MIME : API `users/dto/upload-avatar.dto.ts:5-9`, shared `dto/user.ts:160` (union en littéral), web `EditAvatarModal.svelte:211` (`accept=`).
  - Dimension 512 : API `users/avatar.util.ts:23`, web `EditAvatarModal.svelte:14`.
- **Proposition** : `AVATAR_MIME_TYPES` en `as const` et `AVATAR_MAX_DIMENSION` dans `dto/user.ts`. Les tailles en octets restent côté serveur.

#### SH-19 — Raccourcis de la barre mobile

- **Constat** : API `users/dto/update-user.dto.ts:89-90` et `users.service.ts:362-369` ; web `AppearanceSection.svelte:46-47` et `lib/navigation.ts:384-389`.
- **Proposition** : `MOBILE_NAV_SHORTCUT_LIMITS` et `MOBILE_NAV_REQUIRED_SHORTCUT` dans `dto/user.ts`.

#### SH-20 — Seuil d'expiration des clés API

- **Constat** : web `settings/integrations/api-key-form.ts:7` (`EXPIRING_SOON_DAYS = 7`), API `api-keys/api-key-lifecycle.service.ts:16` (`EXPIRY_WARNING_DAYS = 7`). Le badge doit rester aligné sur le mail.
- **Proposition** : `API_KEY_EXPIRY_WARNING_DAYS` dans `dto/api-key.ts`.

#### SH-21 — Portée `${resource}:read`

- **Constat** : shared `dto/api-key.ts:19-21`, web `ApiKeyCreateModal.svelte:98-100`, API `auth/guards/jwt-auth.guard.ts:139`.
- **Proposition** : `readScope(resource)` dans `dto/api-key.ts`.

#### SH-22 — Règle « film à venir »

- **Constat** : `shared/movie-release.ts:44-49` (que seule l'API appelle). Le web recalcule la même règle dans `routes/app/media/[type]/[id]/+page.svelte:253-267,480`, pour basculer à minuit sans recharger.
- **Proposition** : extraire `isMovieUpcoming(info, now)` et `isReleased(date, now)` dans `movie-release.ts`, et l'utiliser des deux côtés.
- **Lien** : `movieReleaseDates`/`movieReleaseInfo` sont aujourd'hui des fonctions de shared appelées par l'API seule. Les faire consommer aussi par le web justifie leur place dans shared, au lieu de les déplacer côté API.

#### SH-23 — Temps restant d'une série

- **Constat** : web `lib/pile.ts:≈113-138` (`timeLeftToWatch`), API `library/library.service.ts:441-456`.
- **Proposition** : `episodesTimeLeft(type, itemRuntimeMin, episodes)` dans `runtime.ts`. Seule la somme est partagée, le filtrage reste propre à chaque côté.

#### SH-24 — 🐛 Arrondi du minuteur

- **Constat** :
  - API `session-timer/session-timer.service.ts:99-102` : `min(MAX, max(1, ceil(s/60)))`.
  - Web `BookSessionDock.svelte:360` et `GameSessionDock.svelte:306` : **même calcul sans plafond**.
- **Proposition** : `timerMinutes(elapsedSeconds)` dans `dto/session.ts`.

#### SH-25 — Domaines « à session »

- **Constat** : shared `dto/session.ts:8`, API `session-timer/dto/start-session-timer.dto.ts:6-7` et `session-timer-response.dto.ts:8`, web `SessionTimerControl.svelte:26`.
- **Proposition** : `SESSION_DOMAINS` en `as const` et `type SessionDomain`.

#### SH-26 — Type de critique → domaine

- **Constat** : API `reviews/review.service.ts:43-50` (`DOMAIN_BY_TARGET`), web `routes/app/reviews/+page.svelte:41-48` (`GROUP_OF`).
- **Proposition** : `REVIEW_TARGET_DOMAIN: Record<ReviewTargetType, StatsDomain>` dans `dto/review.ts`.

#### SH-27 — 🐛 Normalisation de texte insensible aux accents

- **Constat** :
  - Le motif `normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim()` apparaît dans `api/catalog/search-ranking.ts:4-6`, web `AddToListModal.svelte:66`, `ProfileConnectionsModal.svelte:71`, `routes/app/reviews/+page.svelte:72`, `settings/search.ts:27` et `settings/streaming/+page.svelte:79`. `users/username.util.ts:7-9` en a une variante NFKD.
  - **Écarts de comportement** :
    - le filtre `q` de la bibliothèque côté serveur (`library.service.ts:648`) fait seulement `toLowerCase().includes`, donc « pokemon » ne trouve pas « Pokémon » ;
    - le rapprochement à l'import (`import/sources/media/media-match-resolver.ts:114`) ne retire pas non plus les accents.
- **Proposition** : `foldSearchText(value)` dans un nouveau `packages/shared/src/text.ts`.
- **Risque** : l'import trouvera davantage de correspondances. Il faut un test.

#### SH-28 — Objectif de lecture

- **Constat** : API `books/dto/upsert-reading-goal.dto.ts:11-12`, web `ReadingGoalEditModal.svelte:62-63`.
- **Proposition** : `READING_GOAL_LIMITS` dans `dto/book.ts`. Le `@Max(100000)` des pages, répété 9 fois côté API, peut y être ajouté en `MAX_PAGE_NUMBER`.

#### SH-29 — Jour local `YYYY-MM-DD`

- **Constat** :
  - Regex de contrat : API `stats/home-stats.controller.ts:11`, shared `movie-release.ts:25` (inline), web `lib/admin-user-filters.ts:19`.
  - `OnThisDayWidget.svelte` envoie une clé locale à l'API via `lib/date.ts` → `localDateInput` (HF-04 résolue, voir §7). SH-29 doit préserver ce jour local lors du déplacement vers shared.
- **Proposition** : `LOCAL_DAY_RE` et `localDayKey(date, timeZone?)` dans un nouveau `packages/shared/src/date.ts`. Implémentation par Intl, sans dépendance. Ce module accueillerait aussi `DAY_MS` (CB-01).

#### SH-30 — `DEFAULT_PAGE_SIZE`

- **Constat** : web `UserSelector.svelte:26` (`PAGE_SIZE = 20`) contre API `common/pagination.util.ts:17`. Le commentaire de ce dernier rappelle des dérives passées.
- **Proposition** : `DEFAULT_PAGE_SIZE` et `MAX_PAGE_LIMIT` dans `dto/pagination.ts`.

#### SH-31 — `AlertChannel`

- **Constat** : shared `alerts.ts:272,278,288`, API `notifications/notification-digest.service.ts:14`, web `settings/communications/AlertGrid.svelte:28`.
- **Proposition** : exporter `type AlertChannel` depuis `alerts.ts`.

#### SH-32 — Contrats de requête non garantis

- **Constat** :
  - Les `*ResponseDto` font `implements`, et un spec le verrouille. En revanche, seules **5 classes `*Body` sur 28** implémentent leur DTO de requête shared.
  - Exemple : `CreateCommentDto` (`shared/dto/comment.ts:72`) contre `CreateCommentBody` (`apps/api/src/comments/dto/create-comment.dto.ts:22`) ; `CreateListDto` (`dto/list.ts:86`) contre `CreateListBody` (`lists/dto/create-list.dto.ts:15`).
  - Conséquence : le web envoie une forme que rien ne relie au validateur.
- **Proposition** : ajouter `implements` et l'étendre au spec `response-dto-implements`, ou supprimer les interfaces de requête shared que le web n'importe pas (voir SH-35).

#### SH-33 — `dto/api-v1.ts` réservé à l'API

- **Constat** : 21 exports sur 21 ne sont importés que par `apps/api/src/public-api/v1/**`. Le web et la doc ne les importent jamais, la doc lisant `openapi-v1.json`.
- **Proposition** : déplacer vers `apps/api/src/public-api/v1/dto/contracts.ts`.
- **Bénéfice** : le contrat public est versionné avec son code.
- **Risque** : faible, environ 12 imports à changer.

#### SH-34 — `dto/data-export.ts` (497 l.)

- **Constat** : 37 exports sur 38 ne servent qu'aux classes miroirs `users/dto/data-export/*-response.dto.ts`. Seul `MigrationExportDto` est importé par le web (`MigrationExportCard.svelte`).
- **Proposition** : déplacer les 37 interfaces côté API.
- **Détail** : `data-export.ts:37` est le seul `import` non-`type` d'une interface dans shared.

#### SH-35 — Fichiers shared réservés à l'API + règle d'appartenance

- **Constat** :
  - Plusieurs fichiers ne sont importés que par l'API : `dto/config.ts`, `dto/entitlement.ts`, `dto/ee.ts`, `dto/link.ts`, `dto/newsletter.ts`, `dto/push.ts`, `runtime.ts:runtimeFor` et `dto/admin.ts:PublicStatsSummaryDto` (l.610).
  - Pour ces routes, le web passe par `typedRequest` et les types OpenAPI.
  - Au total, environ 270 exports sur 546 ne sont importés que par l'API, et ils existent surtout pour le `implements` des `*ResponseDto`.
- **Proposition** : **décision à prendre**, puis à documenter dans le CLAUDE.md. Option recommandée : « une interface de réponse peut rester dans shared tant qu'une classe API l'implémente (contrat documenté) ; une donnée runtime ou une fonction n'y va que si les deux côtés l'utilisent ». Une fois la règle actée, migrer domaine par domaine.
- **Honnêteté** : migrer toutes les interfaces de réponse réservées à l'API serait un gros chantier pour un gain modeste. Je recommande de limiter le geste à SH-33 et SH-34, les deux plus gros, plus évidents.

#### SH-36 — `COMMENT_EMOTE_DISPLAY` réservé au web

- **Constat** : `shared/enums.ts:508`, utilisé seulement par `CommentThread.svelte:554,591`.
- **Proposition** : le déplacer vers `apps/web/src/lib/constants/`.

#### SH-37 — `entryStatusFromProgress` réservé à l'API

- **Constat** : `shared/dto/import.ts:290-297`, utilisé seulement par `import/sources/media/media-import.source.ts:384`. Il recoupe `library/status.util.ts:deriveStatus`.
- **Proposition** : le déplacer vers `apps/api/src/import/`.

#### SH-38 — `XP_RULES` / `XP_RULE_LIST`

- **Constat** :
  - `shared/xp-rules.ts` n'est consommé que par l'API, alors que sa doc annonce un usage web qui n'existe pas.
  - `XP_RULE_LIST` (l.216) porte la mention « No current caller » et n'est utilisé que par son spec (l.68-69). C'est contraire à la règle « no speculation ».
  - C'est un gros objet runtime, probablement embarqué dans le bundle web via le barrel CJS.
- **Proposition** :
  - supprimer `XP_RULE_LIST` ;
  - pour `XP_RULES`, le garder seulement si une page « barème » est prévue, sinon le déplacer vers `apps/api/src/gamification`.
- **Décision** : à Logan.

#### SH-39 — `DEFAULT_INSTANCE_SETTINGS` / `INSTANCE_SETTING_ENV`

- **Constat** : `shared/dto/instance-settings.ts`, API seule. Les noms de variables d'environnement sont un sujet serveur.
- **Proposition** : les déplacer vers `apps/api/src/instance-settings` et mettre à jour le CLAUDE.md, qui les cite.

#### SH-40 — `mergeAlertPrefs`

- **Constat** : fonction de `shared/alerts.ts` utilisée par l'API seule.
- **Proposition** : la déplacer vers `apps/api/src/notifications`, à côté de `readAlertPrefs` (TB-02).
- **À garder dans shared** : les seuils numériques réservés à l'API (`MAX_API_KEYS_PER_USER`, `GHOST_AFTER_DAYS`…). Le coût est nul et certains pourraient servir au web, par exemple `BULK_ENTRIES_MAX_IDS` pour borner la sélection en masse.

---

### Axe 2 — Helpers / utils

#### Back (`apps/api/src`)

Utilitaires qui existent déjà dans `common/` : `chunk`, `mapWithConcurrency`, `toDateOrNull`, `fetchJson`, `localDay`, `parsePageQuery`, `isUniqueViolation`, `secretsMatch`, `compareTitles`, `primaryWebOrigin`, `resolveWorkHref`, `canonicalExternalId`, `parseEnumParam`, `RequestThrottle`, `toCsv`, `safeLang` et `normalizeEmail`. Les pistes ci-dessous relèvent surtout des **contournements** de ces utilitaires.

**HB-01 — `sleep`**

- **Constat** : après HB-02 (voir §7), les copies restantes sont dans `common/http.util.ts` et `common/request-throttle.ts`. `retryDelayMs` est désormais unique.
- **Proposition** : créer `common/async.util.ts` → `sleep` pour ces deux appelants.

**HB-03 — 🐛 `fetch` bruts sans timeout**

- **Constat** : `catalog/omdb.service.ts:41`, `auth/turnstile.service.ts:32` (**sur le chemin du login**), `import/sources/simkl/simkl.source.ts:72,121`, `import/sources/steam/steam.source.ts:392`, `jobs/job-run.service.ts:79`, `newsletter/newsletter.service.ts:144` et `musicbrainz.provider.ts:224`. Seuls `github-public-keys.service.ts:43`, `hibp.service.ts:30` et `admin.service.ts:577` bornent leurs appels.
- **Proposition** : exporter `HTTP_TIMEOUT_MS` depuis `http.util.ts` (où il vaut aujourd'hui `TIMEOUT_MS` privé, à `:6`) et passer `signal: AbortSignal.timeout(...)` partout. Garder le timeout plus court de hibp, qui est sur le chemin du mot de passe.

**HB-04 — User-Agent identifiant**

- **Constat** : `admin/admin.service.ts:573`, `open-library.provider.ts:564-576` et `musicbrainz.provider.ts:286-300`.
- **Proposition** : `identifyingUserAgent(contact)` dans `common/http.util.ts`.

**HB-05 — 🐛 `WEB_ORIGIN` réécrit**

- **Constat** :
  - `auth/invitation.service.ts:82-86` est une copie exacte de `primaryWebOrigin`.
  - `ee/calendar/calendar-feed.service.ts:92-94` et `ee/social/activity-feed.service.ts:137-139` ne retirent pas le `/` final, d'où des URLs **`//app/...`** dans les flux ICS et RSS si `WEB_ORIGIN` se termine par `/`.
  - Autres copies : `notifications/push.service.ts:170`, et en liste d'origines `main.ts:96`, `events/events.gateway.ts:84-87`, `auth/webauthn.service.ts:52-55` et `links/link-resolver.service.ts:82-90`.
- **Proposition** : utiliser `primaryWebOrigin` et ajouter `webOrigins(raw)` dans `common/web-origin.util.ts`. `ee/` a le droit d'importer `common/`.

**HB-06 — `startOfUtcDay` / `startOfUtcMonth`**

- **Constat** : `admin/admin-stats.util.ts:14`, `admin/admin.service.ts:70,76` et `common/quota-tracker.service.ts:4`.
- **Proposition** : les regrouper dans `common/date.util.ts`.

**HB-07 — Intervalles d'année et de mois UTC**

- **Constat** : `books/book-library.service.ts:908-911`, `reports/transparency.service.ts:25-28`, `achievements/registry.ts:452-453` et `social/leaderboard/leaderboard.service.ts:213-220`.
- **Proposition** : `utcYearRange(year)` et `utcMonthRange(date)` dans `common/date.util.ts`.

**HB-08 — « il y a N jours »**

- **Constat** : `sinceDaysAgo` existe dans `security/login-failure.util.ts:9`, mais ce calcul est ré-inliné dans :
  - `book-library.service.ts:517-519`, `game-library.service.ts:488-490`
  - `admin/public-stats.controller.ts:27`, `admin-system-stats.service.ts:59`
  - `achievement.service.ts:430-431`
  - `notification.service.ts:121,260,383`
  - `calendar-feed.service.ts:73`
  - `api-key-lifecycle.service.ts:51,94`
  - `invitation.service.ts:250-252`
  - `xp.service.ts:385`, `session-xp.service.ts:27-29`
- **Proposition** : déplacer `sinceDaysAgo` et ajouter `addDays` dans `common/date.util.ts`.

**HB-09 — Repli `localDay(tz, d) ?? d.toISOString().slice(0,10)`**

- **Constat** : `common/session-period.util.ts:19,41-43`, `gamification/session-xp.service.ts:25-26,61` et `gamification/xp.service.ts:383,393-394`.
- **Proposition** : `localDayOrUtc(timezone, date)` dans `common/local-day.util.ts`. Cela supprime aussi `xp.service.ts:401` (`isoDay`).

**HB-10 — Clé `YYYY-MM-DD`**

- **Constat** : redéclarée dans `xp.service.ts:401`, `stats/video-temporal.util.ts:27`, `users/csv-export.service.ts:8` et `users/migration-export.service.ts:309`. Inlinée dans `auth.service.ts:1141`, `book-session.service.ts:439`, `library.service.ts:1470,2092`, `notification.service.ts:263,301` et `ee/calendar/ics.util.ts:34`.
- **Proposition** : `utcDateKey(date)` dans `common/date.util.ts`.

**HB-11 — Dates à l'import**

- **Constat** :
  - `toDateOrNull` est identique dans `import/sources/simkl/parse-simkl.ts:69` et `trakt/parse-trakt-export.ts:191`, et **entre en collision de nom** avec `common/date.util.ts:2`, qui a une autre signature et pas de garde NaN.
  - `earliest` est identique dans `trakt:197` et `tvtime/parse-export.ts:253`.
- **Proposition** : `import/import-date.util.ts` → `parseDateOrNull` et `earlierOf`. Le `toDateOrNull` de tvtime (`:245`) normalise le fuseau : il reste local.

**HB-12 — Date UTC des CSV livres**

- **Constat** : `goodreads-parse.ts:150-153` et `storygraph-parse.ts:118-120`.
- **Proposition** : `utcDateIso(y, m, d)` dans `import/sources/books/csv-field.util.ts`.

**HB-13 — 🐛 Validation ISBN**

- **Constat** : la même regex `/^(\d{9}[\dX]|\d{13})$/` est dans `babelio-parse.ts:58`, `goodreads-parse.ts:126` et `storygraph-parse.ts:91`. Babelio applique le flag `/i` **sans passer en majuscules**, alors que `open-library.provider.ts:249` compare les ISBN avec `includes`, qui est sensible à la casse.
- **Proposition** : `wellFormedIsbn(cleaned)` dans `csv-field.util.ts`, qui met le `X` en majuscule.

**HB-14 — Import : `indexPlanMatches` / `toMatch`**

- **Constat** : `book-csv.source.ts:408` est identique à `steam.source.ts:428`, et `media/media-match-resolver.ts:92` à `myanimelist/anilist-match-resolver.ts:29`.
- **Proposition** : placer `indexPlanMatches` dans `import/import-source.ts`, et exporter `toMatch` depuis `media-match-resolver.ts`.

**HB-15 — Helpers de session**

- **Constat** : `normalizeSessionNotes` est copié dans `book-session.service.ts:779` et `game-session.service.ts:475`, `validDate` dans `game-session 413-424` et `book-session 693-704`.
- **Proposition** : `common/session.util.ts`, ou `common/session-aggregate.util.ts`, que les deux services importent déjà.

**HB-16 — `stripHtml`**

- **Constat** : `open-library.provider.ts:864` et `catalog/providers/anilist.mapper.ts:236`, avec des regex légèrement différentes.
- **Proposition** : `stripTags(text, { brToNewline })` dans `common/text.util.ts`.

**HB-17 — Idiome `take: limit + 1`**

- **Constat** : environ 15 sites :
  - `admin-imports.controller.ts:82-85`
  - `admin-users.controller.ts:193,204-205,266,270`
  - `invitation.service.ts:94,99-100`
  - `book-session.service.ts:392,464-466`, `game-session.service.ts:246,280-282`
  - `comment.service.ts:141,161,210,217`
  - `import-job.service.ts:176,189`
  - `report.service.ts:275,278-280`
  - `security-event.service.ts:134,138,256,258`
  - `activity.service.ts:180,201,230`
  - `follow.service.ts:390,393`
- **Proposition** : `toPagedResult(rows, limit)` dans `common/pagination.util.ts`.
- **Bénéfice** : supprime le risque de décalage d'une unité.

**HB-18 — `skip` recalculé**

- **Constat** : `(page - 1) * limit` est recalculé dans `comment.service.ts:140,209`, `report.service.ts:274`, `security-event.service.ts:133,255`, `activity.service.ts:179,200`, `follow.service.ts:389` et `import-job.service.ts:175`, alors que `ParsedPage.skip` existe. `security-event.service.ts:226-230` redéfinit même les valeurs par défaut à la main.
- **Proposition** : passer `ParsedPage` aux services, comme le fait déjà `invitation.service`.

**HB-20 — Résolution des cibles d'œuvres dupliquée**

- **Constat** :
  - `lists/list.service.ts:976-1120` recopie `reviews/review.service.ts:519-670`. Le commentaire `list.service.ts:970-975` assume la copie, et c'est elle qui a introduit le bug de SH-05.
  - Variantes : `users/data-export.service.ts:776-830` (titres seulement) ; le regroupement `idsByType` dans `ee/stats/advanced-stats.service.ts:457-463`.
- **Proposition** : `groupIdsByTargetType(rows)` et `resolveWorkTargets(prisma, rows): Map<"TYPE:id", { title, imageUrl, href }>` dans `common/work-href.util.ts`, en s'appuyant sur SH-05.
- **Risque** : moyen, car ce sont des requêtes Prisma batchées. Il faut garder une requête par domaine.

**HB-21 — `select` canonique des external ids**

- **Constat** :
  - Copies nommées : `common/work-href.util.ts:4` (`CANONICAL_INCLUDE`, privé), `list.service.ts:988`, `review.service.ts:531`, `home-stats.service.ts:8` et `activity.service.ts:391-394`.
  - Copies inline : `stats.service.ts:259-260,311-312,343-344,376,411,586,664,738` et `notification.service.ts:142`.
- **Proposition** : exporter `CANONICAL_EXTERNAL_ID_SELECT` depuis `common/external-id.util.ts`.

**HB-22 — P2002 inline**

- **Constat** : `auth/auth.service.ts:189-193`, `achievement.service.ts:114-117`, `xp.service.ts:215-218` et `newsletter.service.ts:70-73`.
- **Proposition** : `isUniqueViolation(err, field?)`, avec un paramètre `field` dont auth a besoin pour lire `meta.target`.

**HB-23 — SHA-256 hex**

- **Constat** : `auth/auth.service.ts:1124` (`hashToken`), `auth/invitation.service.ts:48` et `api-keys/api-key-auth.service.ts:32`. `users/users.service.ts:24` importe `hashToken` **depuis `auth.service`**, ce qui crée un couplage inter-modules.
- **Proposition** : `sha256Hex` dans `common/crypto.util.ts`. `hashApiKey` reste comme wrapper, pour son commentaire CodeQL.
- **À ne pas toucher** : `auth-cookies.ts:135`, qui est une dérivation de clé, pas un hash de token.

**HB-24 — Tokens aléatoires**

- **Constat** : `randomBytes(32).toString("hex")` dans `auth.service.ts:208,328,873`, `invitation.service.ts:114,156` et `newsletter.service.ts:182` ; `randomBytes(24).toString("base64url")` dans `calendar-feed.service.ts:167` et `activity-feed.service.ts:213`.
- **Proposition** : `randomToken(bytes, encoding)` dans `common/crypto.util.ts`.

**HB-25 — Code OTP à 6 chiffres**

- **Constat** : `auth.service.ts:408,462` et `users.service.ts:465`.
- **Proposition** : `randomNumericCode(OTP_CODE_LENGTH)` (voir SH-17).

**HB-26 — Tokens à usage unique dans `auth.service`**

- **Constat** : la même séquence est copiée 3 fois : `register 211-222`, `resendVerificationEmail 328-342` et `requestPasswordReset 873-886`.
- **Proposition** : `issueUserToken(userId, type, ttlMs)`, qui supprime l'ancien token et crée le nouveau dans une transaction.

**HB-27 — `parseEnumParam` contourné**

- **Constat** :
  - `comments/comment.controller.ts:41` et `reviews/review.controller.ts:46` (`parseTarget`).
  - `admin-cache.controller.ts:696-707` (`domainOrThrow`, sensible à la casse).
  - `admin-cache.controller.ts:620-626` (`canonicalId`) duplique en plus `canonicalExternalId`, avec un repli différent sur `externalIds[0]`.
- **Proposition** : `parseEnumParam(value, enum, { errorCode, caseSensitive })`.

**HB-28 — URLs d'images**

- **Constat** : `catalog/providers/tmdb.mapper.ts:184,197,231,263,312,354,364,396,484` et `games/providers/igdb.provider.ts:370,374,432`.
- **Proposition** : helpers locaux `tmdbImage(path, size)` et `igdbImage(id, size)`, plus des constantes de taille.

**HB-29 — Regroupement en O(n²)**

- **Constat** : `library.service.ts:428` et `migration-export.service.ts:251` font `map.set(k, [...(map.get(k) ?? []), v])`.
- **Proposition** : faire un push sur place, sans helper.

**HB-30 — « ids d'épisodes déjà vus »**

- **Constat** : la même requête est faite 5 fois dans `library.service.ts` : `962-969`, `1061-1068`, `1140-1147`, `1270-1277` et `1308-1313`. Les contrôles « épisode introuvable / pas encore diffusé » sont dupliqués entre `1043-1058` et `1228-1243`.
- **Proposition** : une méthode privée `watchedEpisodeIds(userId, where)`.

**HB-31 — Stubs de test dupliqués**

- **Constat** : `stubXp` ×9, `stubAchievements` ×7, `stubEvents` ×6 (book-library, comment, game-library, import-job, library, list, review, music-library), `mockFetchByUrl` ×6 avec deux signatures (open-library, tmdb, igdb, simkl, steam, musicbrainz), `uniqueConstraintError` ×3, `makeConfig` ×4 et `fakeReply` ×3.
- **Proposition** : `apps/api/src/test-utils/` → `stubs.ts`, `mock-fetch.ts` et `prisma-errors.ts`.

#### Front (`apps/web/src`)

**HF-02 — `sessionStorage`**

- **Constat** : `onboarding/OnboardingWizard.svelte:45,52,220` y accède sans try.
- **Proposition** : ajouter des variantes session (ou paramétrer le stockage) dans `local-storage.ts`.

**HF-03 — Retour « copié »**

- **Constat** : 8 copies :
  - `ShareProfileModal.svelte:40-44`
  - `ee/calendar/CalendarSubscribeModal.svelte:38-45`
  - `ee/social/ActivityFeedSubscribeModal.svelte:27-34`
  - `admin/communications/components/EmailTab.svelte:101-106` (1500 ms)
  - `admin/security/+page.svelte:113-117` (1500 ms)
  - `admin/users/components/InviteUserModal.svelte:131-137`
  - `settings/components/MfaSection.svelte:207-211`
  - `settings/integrations/components/ApiKeyCreateModal.svelte:105-111`

  Seuls 2 sites sur 8 font `clearTimeout`, et aucun ne gère le rejet de `writeText`.

- **Proposition** : une classe `CopyFeedback` dans un nouveau `lib/clipboard.svelte.ts`, sur le modèle de `Cooldown`, avec `COPY_FEEDBACK_MS = 2000`.

**HF-05 — `DAY_MS` et jours calendaires**

- **Constat** :
  - `DAY_MS` est redéclaré dans `home/daily-pick.ts:7`, `calendar-days.ts:36`, `api-key-form.ts:8` et `ResumeWidget.svelte:43`.
  - Le littéral `86_400_000` apparaît dans `ThisWeekWidget.svelte:45`, `EpisodesSection.svelte:166`, `feature-badges.ts:40` et `admin/reports/+page.svelte:147`.
  - Le calcul `setHours(0,0,0,0)` + `Math.round(diff / DAY)` est identique dans `ThisWeekWidget.svelte:41-45` et `EpisodesSection.svelte:161-167`.
- **Proposition** : `startOfDay` et `calendarDaysBetween` dans `lib/date.ts`.

**HF-06 — Noms de fichiers datés**

- **Constat** : `UserDrawer.svelte:218`, `MfaSection.svelte:233`, `settings/export/+page.svelte:21,62` et `MigrationExportCard.svelte:44`.
- **Proposition** : `datedFilename(stem, ext)` dans `lib/download.ts`, avec la date locale.

**HF-07 — Helpers coincés dans `home/widgets/media.ts`**

- **Constat** : `epCode`, `mediaHref` et `entryPct` sont réécrits environ 30 fois (voir les listes de SH-05, SH-06 et SH-07). S'y ajoute `media/+page.svelte:75-76`, qui redéfinit son propre `mediaHref`.
- **Proposition** : si SH-05 à SH-07 sont adoptés, la piste se réduit à migrer les appelants vers shared. Sinon, créer `lib/media-presentation.ts`.

**HF-08 — Pluriel à la main**

- **Constat** : environ 60 sites, avec deux règles :
  - `> 1` (convention FR) : `ProfileHeader.svelte:254-336`, `ProfileLibrarySection.svelte:72,76,121`, `routes/app/settings/+page.svelte:111,181,197`, etc.
  - `=== 1` (convention EN) : `BookSessionDock.svelte:289,295,299,570`, `GameSessionDock.svelte:247,253,257,480`, `LibraryBrowser.svelte:426,577,1019`, `lib/pile.ts:40-52`, etc.

  Résultat : « 0 abonné » coexiste avec « 0 éléments », et l'anglais affiche « 0 follower ».

- **Proposition** : `selectPlural(count, { one, other })` dans `lib/format.ts`, basé sur un `Intl.PluralRules` mis en cache. La cible idéale serait les variantes plurielles de Paraglide, mais elle demande de migrer les catalogues.
- **Risque** : le rendu change visiblement pour 0. À faire par lots.

**HF-09 — Pourcentages**

- **Constat** :
  - `admin/jobs/+page.svelte:138`, `admin/stats/components/{Accounts,Catalogue,Social}Section.svelte`.
  - `admin/services/+page.svelte:95` écrit `" %"` alors que `:299,311` écrit `"%"`, ce qui est incohérent dans un même fichier.
  - `routes/app/achievements/labels.ts:169-174` contient déjà un `formatPercent` privé.
- **Proposition** : exporter `formatPercent` depuis `lib/format.ts`, avec éventuellement un `percentParts` pour `KpiStrip`.

**HF-10 — Nombres et langue**

- **Constat** : `routes/app/reviews/+page.svelte:109` (`toLocaleString(undefined, …)`, qui prend la locale du navigateur) et `admin/stats/components/AccountsSection.svelte:88-90` (`Intl.DisplayNames` sans cache).
- **Proposition** : utiliser `formatNumber`, et ajouter `formatLanguage(code)` dans `lib/format.ts`.

**HF-11 — Durées et horloges**

- **Constat** :
  - `music/[id]/+page.svelte:105-118` (`formatTrackDuration`, `formatTotalDuration`), `SessionTimerControl.svelte:83-90` (`formatClock`) et `VideoStatsSection.svelte:174-178`.
  - `formatSessionMinutes` (`session-presentation.ts:16-20`) a `"min"` et `"h"` en dur, donc **n'est pas localisé**.
- **Proposition** : `formatClock(seconds)` dans `format.ts` ; `formatSessionMinutes` réécrit avec `m.*`.

**HF-12 — Debounce manuel**

- **Constat** : `UserSelector.svelte:31-36` fait `$effect` + `setTimeout(250)`.
- **Proposition** : utiliser `debounce()` avec `SEARCH_DEBOUNCE_MS` (CF-02).

**HF-13 — Compte à rebours manuel**

- **Constat** : `routes/(verification)/register/check-email/+page.svelte:10-24` est une copie conforme de `Cooldown.start(60)`, et `CommentThread.svelte:325-340` en a une variante.
- **Proposition** : `new Cooldown()`.

**HF-14 — Déconnexion et redirection**

- **Constat** : la séquence est copiée 5 fois : `ProfileView.svelte:228-231`, `DesktopSidebar.svelte:60-63`, `MenuSheet.svelte:42-46`, `ee/nav/ProgrammeBoardDesktop.svelte:37-40` et `ee/nav/ProjectorDockDesktop.svelte:35-38`. Le calcul de `profileHref` est triplé (`DesktopSidebar:56`, `ProgrammeBoardDesktop:23`, `ProjectorDockDesktop:21`).
- **Proposition** : `signOutAndRedirect()` dans `lib/api/auth.ts`, et `profileHref()` dans `lib/navigation.ts`.

**HF-15 — Libellés → options**

- **Constat** : `pick` existe (`lib/quick-add.ts:101-102`), mais la conversion est réécrite dans `routes/app/{books,games,music}/+page.svelte:34-42`, `ImportWizard.svelte:189-197`, `admin/reports/+page.svelte:57`, `reviews/+page.svelte:81`, `feed/+page.svelte:30` et `home/config/DomainsConfig.svelte:17`.
- **Proposition** : `labeledOptions(labels, values)` dans un nouveau `lib/options.ts`.

**HF-16 — `compact()`**

- **Constat** : `lib/quick-add.ts:98-99` duplique le filtre de `joinMeta`.
- **Proposition** : `presentParts(...)` dans `format.ts`.

**HF-17 — Comparateurs de listes**

- **Constat** : `home/widgets/MyListsWidget.svelte:24-29` et `routes/app/lists/+page.svelte:69-80`, avec des clés différentes pour les mêmes tris.
- **Proposition** : `LIST_COMPARATORS` dans `lib/list-sort.ts`. Il faut mapper les valeurs persistées de `widget.config.sort`.

**HF-18 — Collation**

- **Constat** : `localeCompare` avec `getLocale()` dans `MyListsWidget.svelte:28` et `lists/+page.svelte:76`, mais sans locale dans `ListMembersModal.svelte:66`, `books/[id]/+page.svelte:114` et `settings/streaming/+page.svelte:38`.
- **Proposition** : `compareText(a, b)` dans `format.ts`, avec un `Intl.Collator` mis en cache.

**HF-19 — Paramètres d'URL énumérés**

- **Constat** :
  - `admin/reports/+page.svelte:60-66`, `admin/security/+page.svelte:93-95`, `admin/cache/cache-filters.ts:10` et `search/+page.svelte:33-36`.
  - `admin/users/+page.svelte:82-87` écrit en dur une liste qui duplique `AdminUserFilter`.
- **Proposition** : `enumParam(params, key, allowed, fallback)` dans `lib/admin-filter-url.ts`, à renommer `lib/url-params.ts`.

**HF-20 — Sérialisation de `page` et `limit`**

- **Constat** : `filters.page && filters.page > 1 ? String(...)` est répété 18 fois : `lib/api/admin.ts:126,143,169,331,387,411,428`, `books.ts:36`, `games.ts:35`, `library.ts:38`, `music.ts:33` et `auth.ts:344`, plus la version `limit`.
- **Proposition** : `pageParam` et `limitParam` dans `lib/api/query-params.ts`.

---

### Axe 3 — Constantes

#### Back

**CB-01 — Durées en millisecondes**

- **Constat** :
  - `DAY_MS` est déclaré localement 10 fois : `admin/admin-accounts-stats.service.ts:23`, `admin-stats.util.ts:3`, `admin-system-stats.service.ts:9`, `api-key-lifecycle.service.ts:14`, `invitation.service.ts:22`, `ee/licensing/license-key.ts:15`, `achievements/registry.ts:134`, `security/login-failure.util.ts:6`, `stats/on-this-day.util.ts:3` et `video-temporal.util.ts:11`.
  - `24*60*60*1000` est inliné 9 fois : `public-stats.controller.ts:27`, `auth.service.ts:1040`, `book-library:518`, `book-session:456`, `game-library:489`, `achievement.service:431`, `video-stats.util.ts:63`, `ee/stats/aggregates.util.ts:28` et `mail.service.ts:273`.
  - `86_400_000` est inliné 4 fois : `calendar-feed:73`, `notification.service:121,260,383`.
  - D'autres durées en dur : `HOUR_MS` (`admin-social-stats.util.ts:14`), `× 60_000` (×9 dans auth, webauthn et users), et 48 h dans `session-xp:27` et `xp:385`.
  - Le web (HF-05) et shared lui-même (`dto/library.ts:81,94`) répètent ces calculs.
- **Proposition** : `MINUTE_MS`, `HOUR_MS` et `DAY_MS` dans `packages/shared/src/date.ts` (avec SH-29). Sinon, `common/date.util.ts` côté API et `lib/date.ts` côté web.
- **Honnêteté** : la constante est triviale ; c'est gratuit si SH-29 est fait, et à ne pas mener seul.

**CB-02 — TTL de synchronisation du catalogue**

- **Constat** :
  - `SYNC_TTL_MS` (24 h) est copié dans `catalog/media-item.service.ts:23`, `games/game-item.service.ts:16`, `books/book-item.service.ts:21` et `music/music-item.service.ts:16`, avec des miroirs dans `admin/admin-cache.controller.ts:38` (`STALE_TTL_MS`) et `admin/admin-catalogue-stats.service.ts:22`.
  - Le commentaire `admin-catalogue-stats.service.ts:18-20` est **périmé** : il affirme que games et books n'ont pas de cron de rafraîchissement, alors que `game-item.service.ts:43` et `book-item.service.ts:46` en ont un (`@Cron(EVERY_6_HOURS)`).
- **Proposition** : `CATALOG_SYNC_TTL_MS` et `isFresh(lastSyncedAt)` dans `common/catalog-sync.util.ts`. Cela reste intra-API, donc pas dans shared.

**CB-03 — Durées de vie des tokens couplées**

- **Constat** : `auth/auth.service.ts:61-62` (`"15m"`, 30 jours) et `auth/auth-cookies.ts:12-13` (`15*60`, `30*24*60*60`) définissent les mêmes durées séparément.
- **Proposition** : `auth/jwt.constants.ts`, avec `ACCESS_TOKEN_TTL_SECONDS` et `REFRESH_TOKEN_TTL_DAYS`, dont le JWT et le cookie dérivent tous deux.
- **Bénéfice** : le `Max-Age` du cookie et l'expiration du JWT ne peuvent plus dériver.

**CB-04 — Presets `@Throttle`**

- **Constat** :
  - `{limit:1, ttl:5_000}` ×5 : `comment.controller.ts:130,176`, `list.controller.ts:256`, `review.controller.ts:176` et `social.controller.ts:211`.
  - `{10, 3_600_000}` ×3 : `users.controller.ts:158,172,188`.
  - `{5, 60_000}` ×6 : `auth.controller.ts:142,253,260`, `mfa.controller.ts:116` et `users.controller.ts:266,289`.
- **Proposition** : `REPORT_THROTTLE`, `EXPORT_THROTTLE` et `SENSITIVE_ACTION_THROTTLE`, sur le modèle de `auth/auth-throttle.ts`.

**CB-05 — En-têtes de rate limit**

- **Constat** : `api-keys/public-api.guard.ts:37-42`, `common/cors.ts:25-28`, `public-api/v1/api-responses.ts:14-22,55` et `export-rate-limit.guard.ts:26`.
- **Proposition** : `RATE_LIMIT_HEADERS`, réutilisé par le CORS (`exposedHeaders`).

**CB-06 — URLs de base des providers**

- **Constat** : les sondes de `admin/admin.service.ts:99,114,130,146,164,182,196,213` redupliquent les constantes de chaque provider (`tmdb.provider.ts:42`, `anilist.provider.ts:24`, …).
- **Proposition** : exporter et réutiliser ces constantes.

**CB-07 — Support et Quackback**

- **Constat** :
  - `contact@loomkeep.app` sert de valeur de repli dans `config/public-config.controller.ts:38-40` et `mail/mail.service.ts:618-619,1135`.
  - `https://feedback.loomkeep.app` est écrit dans `mail.service.ts:1649` et `newsletter/newsletter.service.ts:12`.
- **Proposition** : `DEFAULT_SUPPORT_ADDRESS` et `QUACKBACK_ORIGIN`.

**CB-08 — Styles de cron**

- **Constat** :
  - `CronExpression.EVERY_DAY_AT_6AM` (`api-key-lifecycle.service.ts:35`) coexiste avec `"0 6 * * *"` (`security-event.service.ts:162`).
  - Chaînes brutes : `backup.service.ts:93`, `invitation.service.ts:248`, `xp.service.ts:330` et `report.service.ts:445`.
- **Proposition** : harmoniser. Gain faible.

**CB-09 — Tailles de page**

- **Constat** : `REPORT_PAGE_SIZE = 20` (`report.service.ts:31`) vaut `DEFAULT_PAGE_SIZE`. `take: 50` apparaît dans `comment.service.ts:333` et `report.service.ts:391`.
- **Proposition** : utiliser `DEFAULT_PAGE_SIZE` et créer `ADMIN_DRAWER_LIMIT`.

#### Front

**CF-01 — Clés de stockage**

- **Constat** : trois conventions coexistent :
  - préfixe `lk-*` : `accessibility.svelte.ts:3-5`, `theme.svelte.ts:3`, `navStyle.svelte.ts:4`, `DesktopSidebar.svelte:23,68` (littéral répété 2 fois) et `library-view.ts:21,48` ;
  - préfixe `loomkeep.*` : `last-known.ts:34`, `OnboardingWizard.svelte:41` et `api/auth.ts:41` ;
  - sans préfixe : `NewsBanner.svelte:20`.
- **Proposition** : `lib/constants/storage-keys.ts`.
- **Pièges** :
  - **ne pas renommer les valeurs**, sous peine de perdre les préférences enregistrées ;
  - `app.html:51,60,63,66` relit `lk-theme` et `lk-a11y-*` en script inline : ajouter un commentaire de synchronisation.

**CF-02 — Debounce de recherche**

- **Constat** : `DEBOUNCE_MS = 300` est déclaré localement dans les 4 `*SearchPanel.svelte`, et le littéral `300` apparaît dans `LibraryBrowser.svelte:215`, `admin/cache:124`, `admin/security:148`, `admin/users:152`, `search:87` et `EmailTab.svelte:71`.
- **Proposition** : `SEARCH_DEBOUNCE_MS` dans `lib/debounce.ts`. Garder les 400 ms de `SecuritySection.svelte:62`, qui sont voulus.

**CF-03 — Durées de transition**

- **Constat** : 171 occurrences de `duration: reduced ? 0 : N`, avec 16 valeurs distinctes. Les plus fréquentes sont 180 (×27), 120 (×24), 220 (×23) et 200 (×21).
- **Proposition** : une échelle `MOTION_MS` et un helper `motionMs(ms, reduced)` dans `lib/motion.ts`.
- **Risque** : churn élevé. Introduire d'abord le helper sans changer les valeurs.

**CF-04 — Media queries**

- **Constat** :
  - `MediaQuery("min-width: 768px")` est utilisé dans `LibraryBrowser.svelte:467`, `LibraryTable.svelte:53` et `LibraryViewMenu.svelte:39`.
  - Des listeners manuels sont posés dans `settings/components/SettingsSection.svelte:16-23` et `settings/+page.svelte:39-47`.
- **Proposition** : `lib/constants/media-queries.ts`.
- **À laisser** : `layout.svelte.ts:21` (`COMPACT_QUERY`), différente à dessein ; Tooltip, RelativeTime et PosterRail, qui lisent la valeur une seule fois exprès.

**CF-05 — Limite de la recherche intégrée**

- **Constat** : `limit={10}` dans `routes/app/{books:200, games:181, media:225, music:169}/+page.svelte`.
- **Proposition** : `EMBEDDED_SEARCH_LIMIT`.

**CF-06 — URL du widget feedback**

- **Constat** : `WidgetIdentify.svelte:31` écrit l'URL en dur.
- **Proposition** : `` `${FEEDBACK_URL}/api/widget/sdk.js` ``.

**CF-07 — Domaine → page de bibliothèque**

- **Constat** : 3 mappings : `ImportWizard.svelte:92-99`, `profile/ProfileLibrarySection.svelte:25-30` et `lib/saved-views.ts:8-13`. S'y ajoutent `lib/navigation.ts:52-88,263-303` et `lib/home/quick-links.ts:73-94`.
- **Proposition** : ajouter `href` à `DOMAINS` (`lib/constants/domains.ts`).

**CF-08 — Libellé, icône et teinte de domaine**

- **Constat** :
  - `ProfileLibrarySection.svelte:16-23,32-39,41-46` contient 3 copies exactes de `DOMAINS[*]`.
  - Autres copies : `settings/export/+page.svelte:27-52`, `reviews/+page.svelte:51-57`, `stats/stats-domain.ts:9-29` (son commentaire de découplage ne tient plus) et `lib/navigation.ts` (12 occurrences).
- **Proposition** : lire `DOMAINS[d]`.
- **Bénéfice** : ajouter un domaine touche 1 fichier au lieu de 6.

**CF-09 — Libellés et teintes par type de critique**

- **Constat** : `TYPE_LABEL` dans `ProfileReviews.svelte:12-19` et `reviews/+page.svelte:31-38` ; `TYPE_HUE` dans `ProfileReviews.svelte:21-28` ; `DOMAIN_HUE` dans `ProfileActivity.svelte:41-46`.
- **Proposition** : `lib/constants/review-targets.ts`.

**CF-10 — 🐛 Libellés de `MediaType`**

- **Constat** : 10 déclarations :
  - au singulier : `TonightPickWidget.svelte:42-46`, `MediaSearchPanel.svelte:48-52`, `calendar/+page.svelte:126-130`, `media/+page.svelte:69-73`, `media/[type]/[id]/+page.svelte:55-59` et `quick-add.ts:109-113` ;
  - au pluriel : `LibraryBrowser.svelte:217-221`, `search/+page.svelte:112-118`, `WidgetConfigModal.svelte:76-80` et `VideoStatsSection.svelte:45-49`.

  **Incohérence** : les tables au singulier de `media/+page.svelte:72` et `quick-add.ts:112` utilisent `m.media_anime()` (« Anime », forme de liste) au lieu de `m.media_anime_label()` (« Animé »).

- **Proposition** : `lib/constants/media-types.ts` → `MEDIA_TYPE_LABEL`, `MEDIA_TYPE_PLURAL_LABEL` et `MEDIA_TYPE_OPTIONS`.

**CF-11 — Libellés de liste**

- **Constat** : `KIND_LABEL` et `VISIBILITY_LABEL` dans `lists/+page.svelte:19-27` et `lists/[id]/+page.svelte:36-44` ; `AddToListModal.svelte:41-45` ; les options dans `lists/+page.svelte:28-35` et `ListFormModal.svelte:52-75`.
- **Proposition** : `lib/constants/list-labels.ts`.

**CF-12 — Options de tri communes**

- **Constat** : `routes/app/{books:53-63, games:42-50, media:52-60, music:39-46}/+page.svelte`.
- **Proposition** : `COMMON_LIBRARY_SORTS` dans `lib/library-view.ts`, avec une surcharge pour la musique (`music_sort_listened`). Les clés de tri sont, elles, typées par SH-10.

**CF-13 — Options de statut média**

- **Constat** : `media/+page.svelte:38-49` reconstruit les options via `Object.fromEntries … as Record`.
- **Proposition** : `MEDIA_STATUS_ORDER` dans `lib/constants/status-labels.ts`, comme pour les autres domaines.

**CF-14 — Placeholder `"—"`**

- **Constat** : 21 occurrences, par exemple `LibraryTable.svelte:189,221,429` et `admin/+page.svelte:148-226`.
- **Proposition** : `EMPTY_VALUE` dans `format.ts`. À faire seulement au passage.

---

### Axe 4 — Types et interfaces

**Comptage côté API** : 0 `any`, 0 `@ts-ignore`, 3 `as unknown as`, environ 263 `as X` (en majorité des casts d'enum autorisés) et environ 55 assertions `!`.

**Côté web** : 0 `as any` en production. Les 4 `as unknown as` sont documentés.

#### Back

**TB-01 — `as unknown as`**

- **Constat** : `auth/auth.service.ts:1172` et `users/users.service.ts:287` (`homeLayout`) ; `instance-settings/instance-settings.service.ts:61`.
- **Proposition** :
  - `readHomeLayout(json)` et `toHomeLayoutJson(layout)` dans `users/` ;
  - un reduce typé sur `KEYS` pour `instance-settings`.

**TB-02 — `alertPrefs`**

- **Constat** : `user.alertPrefs as AlertPrefs` dans `auth.service.ts:1147`, `notifications/admin-alert.service.ts:46`, `notification.service.ts:513` et `users.service.ts:373`.
- **Proposition** : `readAlertPrefs(json)`, avec `mergeAlertPrefs` (SH-40).

**TB-03 — Colonnes JSON**

- **Constat** :
  - `(x.data ?? {}) as Record<string, unknown>` dans `notification.service.ts:486,623`, `activity.service.ts:245` et `data-export.service.ts:546,667`.
  - `as Prisma.InputJsonValue` ×6.
- **Proposition** : `jsonObject(value)` avec une vraie garde, dans `common/json.util.ts`.

**TB-04 — Mappers de cycles**

- **Constat** :
  - `games/game-session.service.ts:453-473` (`toPlaythroughDto`) n'a pas de type de retour, utilise un type structurel inline et un cast `as "ACTIVE" | …`. Il duplique `game-library.service.ts:820-833`, qui est correctement typé.
  - Même cas pour `book-session.service.ts:749-777` et `book-library.service.ts:≈950-976`.
- **Proposition** : `games/game.mappers.ts` et `books/book.mappers.ts`, typés par `Prisma.GamePlaythroughGetPayload<…>`.
- **Bénéfice** : un nouveau statut casse la compilation au lieu d'être masqué par le cast.

**TB-05 — Prédicats de type manquants**

- **Constat** : `!` après un `filter` dans `ee/stats/advanced-stats.service.ts:109,117,124,198,209,218,225`, `trakt/parse-trakt-export.ts:91,160`, `igdb.provider.ts:583`, `comment.service.ts:249,1002`, `review.service.ts:706` et `achievements/registry.ts:194,488`.
- **Proposition** : `.filter((m): m is … => …)`.

**TB-06 — `dto.listId!` dans des closures**

- **Constat** : `game-library:442`, `music-library:360`, `library:506` et `book-library:471`.
- **Proposition** : capturer la valeur dans une constante locale, ou passer `listId` à `addToList` (`common/bulk-entries.util.ts`).

**TB-07 — Token relu après `update`**

- **Constat** : `calendar-feed.service.ts:170` et `activity-feed.service.ts:216`.
- **Proposition** : générer le token dans une constante et la renvoyer, en lien avec HB-24.

**TB-08 — Variables d'env**

- **Constat** : `push.service.ts:39,51`.
- **Proposition** : stocker les valeurs validées dans des champs.

**TB-09 — `Map.get(...)!`**

- **Constat** : `list.service.ts:281,399,416`, `leaderboard.service.ts:86`, `steam.source.ts:195,283` et `book-csv.source.ts:153,208,348`. Ces accès sont sûrs par construction.

**TB-10 — Quotas**

- **Constat** : `common/quota-tracker.service.ts:79` fait `PROVIDER_DAILY_QUOTAS as Record<string, number>`.
- **Proposition** : typer `provider` en `keyof typeof PROVIDER_DAILY_QUOTAS`.

#### Front

**TF-01 — `IconName`**

- **Constat** : `ComponentProps<typeof Icon>["name"]` est redéclaré dans `LibraryBrowser.svelte:87`, `PageHeader.svelte:8` et `MenuSheet.svelte:23`.
- **Proposition** : importer `lib/types/icon-name.ts`.

**TF-02 — Type option**

- **Constat** : `{ value; label }` est redéclaré environ 20 fois :
  - `LibraryBrowser.svelte:89-92`, `Combobox.svelte:12`, `SegmentedControl.svelte:8`
  - `Tabs.svelte:16`, `list-navigation.ts:3`
  - et inline dans `admin/cache:42`, `search:112,120,126`, `AppearanceSection.svelte:51-59`, `library-view.ts:150-161`, etc.
- **Proposition** : `lib/types/select-option.ts` → `SelectOption<T extends string = string>`.

**TF-03 — Points de graphique**

- **Constat** : `stats/HistogramBars.svelte:8`, `LineChart.svelte:12`, `RankBars.svelte:10-13` et `StackedBar.svelte:5-8`.
- **Proposition** : `ChartDatum`, dans `stats-domain.ts` ou `lib/types/chart.ts`.

**TF-04 — `ListTile`**

- **Constat** : `profile/ProfileView.svelte:104-106` et `ProfileListsSection.svelte:9-11`.
- **Proposition** : l'exporter depuis un `<script module>` ou un `.ts` voisin.

**TF-05 — `ActivityKind`**

- **Constat** : `admin/users/components/UserActivityModal.svelte:22-23` et `UserDrawer.svelte:48-49`.
- **Proposition** : un `.ts` local au dossier.

**TF-06 — `BannerVariant`**

- **Constat** : redéclaré dans `routes/app/admin/components/+page.svelte:31`, alors que `banner-semantics.ts:1` l'exporte.
- **Proposition** : l'importer.

**TF-07 — `"ALL" | StatsDomain`**

- **Constat** : `stats/DomainFilter.svelte:11` et `routes/app/stats/+page.svelte:52`.
- **Proposition** : `StatsDomainChoice` dans `stats-domain.ts`.

**TF-08 — 🐛 `FeatureBadgeKey` affaibli en `string`**

- **Constat** :
  - `lib/feature-badges.ts:35` ne l'exporte pas, et `isFeatureNew(key: string)` caste en interne (`:38`).
  - `routes/app/settings/nav.ts:10` le redéclare via `Parameters<…>[0]`, ce qui donne `string`.
  - `lib/types/import-descriptor.ts` déclare `newBadgeKey?: string`.
  - Conséquence : une faute de frappe dans une clé de badge « Nouveau » passe en silence, et le badge ne s'affiche jamais.
- **Proposition** : exporter `FeatureBadgeKey` et typer `isFeatureNew(key: FeatureBadgeKey)`.

**TF-09 — `as Domain`**

- **Constat** : environ 20 casts dus à `Object.keys/entries(DOMAINS)`, dans `lib/domains.ts:41,58-60`, `search/+page.svelte:27-216`, `admin/cache:215,233`, `PrivacySection.svelte:147-218`, `settings/+page.svelte:122` et `settings/import/+page.svelte:44-178`.
- **Proposition** : `DOMAIN_IDS` (un seul cast) dans `lib/constants/domains.ts`, et `typedEntries` dans `lib/object.ts`.

**TF-10 — `Object.fromEntries(...) as Record`**

- **Constat** : 8 occurrences, dans `stats/DomainFilter.svelte:25-48`, `PeriodFilter.svelte:35-40`, `constants/report-labels.ts:130-132`, `media/+page.svelte:47-49` et `QuickAddPanel.svelte:248-256`.
- **Proposition** : `recordFrom(keys, fn)` dans `lib/object.ts`.
- **Cause racine** : l'API à trois records parallèles de `SegmentedStatusControl`.

**TF-11 — `Record<string, …>` sur des clés typées**

- **Constat** : `ProfileLibrarySection`, `ProfileActivity`, `ProfileReviews`, `VideoStatsSection.svelte:45,50`, `lists/+page.svelte:19,23` et `lists/[id]/+page.svelte:36,40`.
- **Proposition** : `Record<Domain | MediaType | ListKind…, …>`. Les pistes CF-08 à CF-11 le règlent de fait.

**TF-12 — `quick-add.ts`**

- **Constat** : 8 casts `raw as XDetail` (`lib/quick-add.ts:140-277`), parce que `detail: unknown`.
- **Proposition** : `QuickAddDomain<TDetail>`.
- **Risque** : moyen, à cause de la variance générique.

**TF-13 — `ImportSourceDescriptor` ment**

- **Constat** : `lib/constants/import-sources.ts:33-126` contient 7 casts `as ImportSourceDescriptor` sur des sources « bientôt » sans `href`/`input`/`noun`. S'y ajoutent des `m.…() as string` superflus.
- **Proposition** : une union discriminée `comingSoon: true`, dans `lib/types/import-descriptor.ts`.

**TF-14 — `$props()` non typés**

- **Constat** : 3 composants (`DesktopSidebar.svelte:41`, `ee/nav/ProgrammeBoardDesktop.svelte:16`, `ProjectorDockDesktop.svelte:16`) et environ 10 layouts.
- **Proposition** : `{ children }: { children: Snippet }`, et le `LayoutProps` de `./$types` pour les layouts.

---

### Axe 5 — Autres refactors

#### Back

**RB-03 — Contournements d'`assertEntryOwnership`**

- **Constat** : `game-session.service.ts:292-323` et `book-session.service.ts:552-584` (`ownedEntry`) réécrivent la logique 404/403, et les `ownedSession` (`325-357` / `586-620`) sont jumeaux.
- **Proposition** : `assertEntryOwnership(userId, finder)` et un nouveau `assertSessionOwnership` dans `entry-lifecycle.util.ts`.

**RB-04 — XP de fin de cycle**

- **Constat** :
  - `game-library.service.ts:266-297` et `569-593`, `book-library.service.ts:≈300-330` et `≈607-627` : révoquer en quittant l'état terminal, attribuer `*_FINISHED`/`*_REPLAYED`, puis évaluer les succès.
  - `book-session.service.ts:364-378` (`awardCompletion`) existe déjà, mais `book-library` ne l'utilise pas.
- **Proposition** : `syncCycleCompletionXp(...)` dans `entry-lifecycle.util.ts`.

**RB-05 — Correspondance cycle → statut d'entrée**

- **Constat** : `game-session 203-213` et `book-session 248-262`.
- **Proposition** : extraire seulement la table par domaine. Fusionner `syncPlaythroughStatus`/`syncReadingStatus` est **déconseillé** (voir Points écartés).

**RB-06 — Nettoyage XP des `deleteEntry`**

- **Constat** : `game-library 617-664`, `book-library 651-≈700`, `music-library 493-520` et `library 805-862`.
- **Proposition** : `revokeEntryXp(xp, { entryId, entrySource, reviewIds, cycleSource?, cycleIds? })`. Le surplus propre au média reste local.

**RB-07 — Filtre PAUSED/dormant**

- **Constat** : `game-library 472-506` est identique à `book-library 501-535`.
- **Proposition** : `pausedStatusClause(activeStatus, now)` dans `entry-lifecycle.util.ts`.

**RB-08 — Double lecture**

- **Constat** : `assertEntryOwnership` charge l'entrée, puis le code la relit dans `game 508-513/529-534`, `book 537-542/557-562`, `music 406-411/426-431` et `library 662-667/686,700-703`.
- **Proposition** : passer l'`include` au finder.
- **Bénéfice** : 1 à 2 requêtes de moins par appel.

**RB-09 — Services `*-item`**

- **Constat** : `game-item 138-257`, `book-item 181-296`, `music-item 64-180` et `media-item 268+` (`upsertFromSource`, `persistDetails`, `forceRefresh`). Chaque `forceRefresh` réimplémente `canonicalExternalId` (exemple : `game-item 190-192`).
- **Proposition** : CB-02, plus l'usage de `canonicalExternalId`. Une classe de base générique est déconseillée (voir Points écartés).
- **Question** : music n'a pas de cron `refreshStale`. Est-ce voulu, à cause du débit de 1 requête par seconde de MusicBrainz ?

**RB-10 — Découper `library/library.service.ts` (2163 l.)**

- **Découpage proposé** :
  - `LibraryService` (CRUD, liste, pile, bulk, `217-865`) ;
  - `EpisodeWatchService` (`937-1400`, `1507-1572`) ;
  - `MediaProgressService` (`syncFinishedAt 891-935`, `progressCounts…lastWatchedAt 1581-1818`) ;
  - `MediaCalendarService` (`getCalendar 1402-1500`) ;
  - `MediaDetailService` (`1928-2136`).
- **Pour éviter les cycles** : `MediaProgressService` est une feuille, et `Library → EpisodeWatch` va dans un seul sens (via `watchAllAired 560-575`). Tout reste dans `LibraryModule`.

**RB-11 — `computeProgress`**

- **Constat** : `1758-1807` duplique la logique « épisode suivant » de `computeProgressBatch` (`1650-1756`).
- **Proposition** : `computeProgress = batch([id]).get(id)`, ce qui fait passer de 3 à 2 requêtes dans `getEntry`/`upsert`/`update`.

**RB-12 — `watchRegion`**

- **Constat** : `updateEntry 703-713` réimplémente `movieRegion` (`2127-2136`).
- **Proposition** : réutiliser `movieRegion`. Le repli de `getCalendar 1464-1474` est différent à dessein : on le garde.

**RB-13 — `markUnwatched` mal nommé**

- **Constat** : `library.service.ts:1303-1346` marque comme **vus** les épisodes non vus.
- **Proposition** : le renommer `markWatchedIfNew`.

**RB-14 — `admin-cache.controller.ts` (772 l., 28 appels Prisma)**

- **Constat** :
  - Un `switch` sur 4 domaines est répété 6 fois : `list 95-206`, `detail 210-334`, `removeOrphans 387-445`, `remove 457-514`, `staleIds 641-654` et `referenceCount 656-694`, plus `idsWithContent 516-597`.
  - La recherche (`112-115`) n'échappe pas `%`/`_`, alors que `titleContains` existe.
- **Proposition** : `AdminCacheService`, avec un registre `CACHE_DOMAINS: Record<CacheDomain, { delegate, forceRefresh, coverField, targetType }>`, et un contrôleur réduit au routage.
- **Risque** : casts sur les delegates Prisma ; garder la transaction Serializable réservée au média.

**RB-15 — Modération**

- **Constat** : `admin-reports.controller.ts` : `takeDown` (`175-275`) réimplémente `decide` (`446-552`) : contrôle PENDING, avis, `resolveInTransaction`, publication et mail.
- **Proposition** : `ModerationActionService` avec `decide`, `removeContent` (`554-593`) et `takeDown`, qui passe par `decide` avec un hook `afterCommit`. `summary 107-152` part dans `ReportService`.

**RB-16 — `admin-users.controller.ts`**

- **Constat** : il porte du métier : `listUsers 110-241` (135 lignes de construction du `where`), `listUserOptions 245-275`, `getUserLibraryStats 401-428` (qui recoupe `LibraryService.getDomainCounts 321-340`), `reactivateUser 457-467` et `sendPasswordResetLink 478-490`.
- **Proposition** : `AdminUsersService`.

**RB-17 — Petits contrôleurs admin**

- **Constat** : `admin-push 38-130`, `admin-imports 30-100` et `admin-system 87` font des agrégats en lecture seule.
- **Proposition** : les migrer vers des services, plus tard.

**RB-18 — Résolution « profil visible ou 404 »**

- **Constat** : 9 copies :
  - `social/profile.service.ts` : `getProfile 67-91`, `resolveTimelineTarget 281-301`, `reportTargetId 305-318` et `resolveConnectionsTarget 348-368` (les deux derniers resolve sont identiques) ;
  - `social/follow.service.ts` : `49-66`, `276-281`, `337-342`, `353-358` et `409-414`.
- **Proposition** : `VisibilityService.resolveVisibleUser(viewerId, username, select)`.

**RB-19 — Garde de domaine**

- **Constat** : 34 appels à `domainGate.assertEnabled` (music 10/10, books 6/17, games 5/14, library 4/18, stats 8).
- **Proposition** : décorateur `@RequireDomain(Domain.X)` et `DomainGateGuard`.
- **À trancher d'abord** : music garde aussi les mutations parce que c'est un domaine premium, mais les autres domaines ne bloquent pas les mutations en maintenance. L'incohérence est-elle voulue ?

**RB-20 — `mail/mail.service.ts` (1929 l.)**

- **Découpage proposé** :
  - helpers HTML `66-171` → `mail-html.util.ts` ;
  - galerie de templates `235-611` → `mail-templates.registry.ts` ;
  - 24 `build*` (`1015-1754`) → `mail-templates.ts`, en fonctions pures qui reçoivent un `MailContext` ;
  - layout `1755-1900` → `mail-layout.ts`.
- `MailService` garde la configuration, le transport et les `send*`.

**RB-21 — `mail/mail.i18n.ts` (1208 l.)**

- **Proposition** : `mail/copy/{types,fr,en,it,index}.ts`, découpé selon les sections actuelles : interface `25-234`, fr `236-559`, en `560-878`, it `879-1208`. Mettre à jour le skill `add-locale`.

**RB-22 — `gamification/achievements/registry.ts` (1677 l.)**

- **Découpage proposé** : checks `50-1024` → `checks/{media,finishers,streaks,social,profile,seasonal}.ts` ; `ACHIEVEMENTS` `1026-1548` → `definitions.ts` ; déclencheurs `1549-1677` → `triggers.ts`.
- **Bénéfice** : les services de bibliothèque importent un fichier léger.

**RB-23 — `lists/list.service.ts` (1121 l.)**

- **Proposition** : `ListMemberService` (`633-796`) et la résolution des cibles (`954-1120`, voir HB-20). Garder `ListService` comme façade, car il est injecté dans 4 services de bibliothèque, dans `AccountDeletion` et dans `admin-reports`.

**RB-24 — `comments/comment.service.ts` (1123 l.)**

- **Proposition** :
  - `CommentReactionService` (`616-716`) et `CommentNotificationService` (`941-1121`) ;
  - remplacer `ensureParticipationAllowed` (`717-796`, `switch` sur 4 entrées) par `hasLibraryEntryFor(prisma, userId, targetType, targetId)`.

**RB-25 — `auth/auth.service.ts` (1174 l.)**

- **Proposition** :
  - `SessionService` (`refresh 681-780`, `logout`, `list/revoke 801-866`, `signTokens 1003-1050`, `1051-1122`), qui doit être une feuille ;
  - `MfaLoginService` (`400-646`) ;
  - `AccountRecoveryService` (`278-349`, `869-965`).

**RB-26 — `users/users.service.ts` (891 l.)**

- **Proposition** :
  - `deletionSummary 608-802` → `AccountDeletionService.summary()` (sa doc dit qu'il « mirrors » ce service) ;
  - changement d'email `439-553` → `EmailChangeService` ;
  - avatar `143-220` → `AvatarService`.

**RB-27 — `users/data-export.service.ts`**

- **Constat** : `buildExport` est une **méthode unique de 746 lignes** (`30-775`) : requêtes `42-209`, puis mapping `364-774`.
- **Proposition** : des mappers purs par section dans `data-export.mappers.ts`.

**RB-28 — `reviews/review.service.ts` (913 l.)**

- **Proposition** : `ReviewVoteService` (`141-297`) et `RatingService` (`756-868`), pour que les 4 services de bibliothèque ne dépendent plus que de `RatingService`. Les cibles passent par HB-20.

**RB-29 — `stats/stats.service.ts` (873 l.)**

- **Proposition** : factoriser les 4 `fetch*Rows` quasi identiques (`245-393`) et extraire `VideoStatsService` (`394-644`).

**RB-30 — `public-api/v1/dto/responses.dto.ts` (871 l.)**

- **Constat** : c'est la seule exception à la règle « un DTO par fichier ».
- **Proposition** : le découper par ressource.

**Méthodes de plus de 100 lignes, pour référence** :

- `buildExport` 746 ;
- `home-stats.onThisDay` 247 (`stats/home-stats.service.ts:25`) ;
- `deletionSummary` 195 ;
- `profile.getProfile` 161 ;
- `getVideoStats` 144 ;
- `review.resolveTargets` 140 ;
- `notification.runScanAll` 140 (`:118`) ;
- `list.resolveTargets` 135 ;
- `admin listUsers` 135 ;
- `steam.buildPlan` 133 (`:79`) ;
- `comment.create` 132 (`:353`) ;
- `auth.register` 130 (`:112`) ;
- `admin-cache detail` 127 ;
- `library.updateEntry` 125 ;
- `users.updateMe` 120 (`:301`) ;
- `media-import.buildPlan` 116 ;
- `open-library.getDetails` 116 (`:267`) ;
- `book-library.upsertEntry` 110 ;
- `computeProgressBatch` 108 ;
- `advanced-stats.social` 108 (`ee/stats/advanced-stats.service.ts:325`) ;
- `decide` / `takeDown` 108 ;
- `computeActivityStats` 107 ;
- `notification-digest.deliverChannel` 107 ;
- `notification.scan` 105 ;
- `getCalendar` 105 ;
- `library.upsertEntry` 104 ;
- `mediaDetailFromCache` 103 ;
- `game-library.upsertEntry` 103 ;
- `book-session.summary` 101 ;
- `auth.refresh` 100.

Les pistes RB-10 et RB-20 à RB-29 en couvrent la majorité.

#### Front

**RF-01 — Docks de session jeu/livre**

- **Constat** : `lib/components/GameSessionDock.svelte` (821 l.) et `BookSessionDock.svelte` (1008 l.) sont dupliqués à environ 85 %. Sections jumelles, lignes jeu puis livre :

  | Section                                  | Jeu     | Livre    |
  | ---------------------------------------- | ------- | -------- |
  | 5 mutations aux `invalidates` identiques | 132-243 | 168-285  |
  | Groupement par cycle                     | 104-130 | 140-166  |
  | `weeklySummary`                          | 245-254 | 287-296  |
  | `cycleAction`                            | 276-282 | 326-332  |
  | Handlers                                 | 298-325 | 352-379  |
  | En-tête                                  | 347-376 | 418-445  |
  | Graphique de la semaine                  | 391-416 | 476-501  |
  | Pied de carte                            | 470-509 | 560-599  |
  | Switch reprendre / continuer             | 532-568 | 628-664  |
  | Date et notes                            | 570-605 | 709-744  |
  | Modal d'historique complet               | 632-810 | 775-997  |
  | Confirmation de suppression              | 812-821 | 999-1008 |

- **Proposition** :
  - `lib/session-dock.ts`, fonctions pures testables : `cycleAction`, `groupSessionsByCycle` et `weeklySummary` ;
  - `lib/session-dock-mutations.svelte.ts` ;
  - `SessionHistoryModal.svelte`, générique avec snippets ;
  - `SessionCycleSwitch.svelte`, `SessionNotesField.svelte` et une coque `SessionDockShell.svelte`.
- **Gain** : environ 1 800 lignes ramenées à environ 900.
- **Risque** : moyen, car **aucun spec ne couvre les docks**. Écrire d'abord un test de caractérisation. Les clés i18n et le mode quantité/plage restent propres au livre.

**RF-02 — Coque des pages détail**

- **Constat** : sections identiques dans `games/[id]`, `books/[id]` et `music/[id]` :
  - `<svelte:head>` : 181-186 / 204-209 / 139-144 ;
  - erreur et retour : 188-194 / 211-217 / 146-152 ;
  - hero : 197-233 / 220-233 / 155-168 ;
  - couverture et titre ;
  - bouton Ajouter : 355-364 / 338-347 / 235-244 ;
  - **panneau latéral rendu deux fois** (`md:hidden` puis `hidden md:block`) : 433-437 et 558-562, etc. ;
  - ConfirmationModal : 566-575 / 557-566 / 430-439 ;
  - squelette.
- **Proposition** : `lib/components/detail/DetailLayout.svelte` (snippets `hero`, `main` et `aside`, ce dernier rendu aux deux positions) et `DetailHero.svelte`.
- **Exception** : la page média (hero en overlay, ActionBar) ne partage que l'erreur, la confirmation, le head et le squelette.

**RF-03 — Bloc avis et commentaires**

- **Constat** : `games 463-487`, `books 426-450` et `music 344-368`. `canParticipate={!!entry}` est **constant** dans chaque branche : toujours vrai dans `{#if entry}`, toujours faux dans `{#if … && !entry}`, aux lignes 476/486, 439/449 et 357/367.
- **Proposition** : `WorkSocialSection.svelte`.

**RF-04 — Notes externes**

- **Constat** : le balisage `<svelte:element this={r.url ? "a" : "span"}>` est répété dans `books/[id] 297-319`, `games/[id] 292-306` et `media/[type]/[id] 503-517`, et `RATING_STYLES` dans `games 60-63`, `books 58-63` et `media 86-92`.
- **Proposition** : `RATING_SOURCE_STYLES` dans `lib/provider-brands.ts` et un composant `ExternalRatingChips.svelte` avec une variante `overlay`. Les classes Tailwind doivent rester littérales.

**RF-05 — Carte « Détails »**

- **Constat** : `games 501-557`, `books 454-548` et `music 372-421`, plus les `hasMeta`.
- **Proposition** : `DetailsCard.svelte`.

**RF-06 — Correction de statut**

- **Constat** : identique entre jeux et livres : `statusCorrections` (`155-170`/`153-168`), `openStatusCorrection`, les actions de `TrackingPanel` (`372-405`/`355-388`) et le modal (`577-596`/`568-587`).
- **Proposition** : `cycleAwareStatusCorrections()` dans `lib/status-corrections.ts`, qui a déjà un spec, et `StatusCorrectionModal.svelte`.

**RF-07 — Galerie**

- **Constat** : `games 107-136`, `media 104-132` et `music 87-104`.
- **Proposition** : `lib/gallery.ts`, pur et testé.

**RF-09 — Widgets d'accueil**

- **Constat** : `ResumeWidget.svelte:47-63` et `ToWatchWidget.svelte:63-99` avalent les erreurs et gèrent un `busy` manuel.
- **Proposition** : `createApiMutation`. La logique « reprendre » peut aller dans `widgets/media.ts`.

**RF-10 — Requêtes manuelles**

- **Constat** : `ImportWizard.runSearch` (`371-394`), `CommentMentionInput.svelte:158-182` (garde de course par `requestId` faite à la main) et `SecuritySection.svelte:53-73` (vérification du pseudo).
- **Proposition** : `createApiQuery` sur les clés existantes `keys.*.search` et `keys.comments.participants`.

**RF-11 — Clés de requête hors de `keys.ts`**

- **Constat** : `CommentsPanel.svelte:47`, `CommentThread.svelte:66-67` (l'exception TanStack porte sur le TanStack brut, pas sur les clés), `LibraryBrowser.svelte:439,522,547,568`, `LibraryReviewEditor.svelte:27` et `QuickAddPanel.svelte:99`.
- **Proposition** : `keys.comments.{thread,count,participants}`, `keys.library.all()` et `keys.library.browseDomain(d)`.

**RF-12 — `LoadMoreButton`**

- **Constat** : 11 copies :
  - `admin/cache 395-404`, `admin/imports 252-261`, `admin/reports 482-491`, `admin/security 342-351`, `admin/users 522-532`, `InvitationsPanel 273-283`
  - `feed 101-110`, `settings/activity 140-149`, `settings/blocked-users 74-85`, `settings/import/history 117-128`
  - `ProfileActivity 139-150`

  Libellés incohérents (`common_load_more` contre `common_see_more`), largeur variable, et **aucun `type="button"`**.

- **Proposition** : `LoadMoreButton.svelte`, qui prend l'objet infinite query.

**RF-13 — `use:inView`**

- **Constat** : `LibraryBrowser 319-331` est identique à `MediaSearchPanel 151-163`, et `CommentThread 212-234` en a une variante avec `root`.
- **Proposition** : `lib/actions/inView.ts`.

**RF-14 — Squelettes KPI**

- **Constat** : 5 pages admin : `reports 293-316`, `security 227-248`, `imports 142-162`, `stats 147-156` et `services 177-186`.
- **Proposition** : `KpiStripSkeleton.svelte` et `RankBarsSkeleton.svelte` dans `lib/components/stats/`.

**RF-15 — Pastille de statut**

- **Constat** : `rounded-full border px-2 py-0.5 text-xs font-bold` est répété dans `reports:370`, `security:297`, `imports:204,225`, `UserActivityModal:178` et `cache:341-467` (7 fois).
- **Proposition** : une classe `.pill` avec des modificateurs dans `app.css`, comme DESIGN.md le prévoit. Une classe convient mieux qu'un composant ici.

**RF-16 — `AvatarLightbox.svelte`**

- **Constat** : il réimplémente `Lightbox` sans `portal`, `scrollLock` ni `dialogFocus` : le **focus n'est pas piégé** et le défilement n'est pas bloqué.
- **Proposition** : réutiliser la coque de `Lightbox`, via un snippet de contenu ou une base `LightboxFrame`.

**RF-17 — Page de recherche**

- **Constat** :
  - `routes/app/search/+page.svelte` : le filtre est un dropdown fait main (`135-184`, `251-307`) avec 3 boucles identiques, sans rôle ARIA ni navigation clavier.
  - Les onglets de domaine (`209-225`) n'ont aucune sémantique d'onglet.
- **Proposition** : `Dropdown` en `role="listbox"`, et `Tabs` étendu avec icône et badge.

**RF-18 — Panneaux de recherche**

- **Constat** : `search/{Book,Game,Music}SearchPanel.svelte` sont identiques à environ 90 %. Seuls changent les fonctions API, le préfixe de requête, la ligne de méta et l'attribution IGDB.
- **Proposition** : un `CatalogSearchPanel.svelte` générique et `lib/search-query.ts`, pur et testé, pour les préfixes `author:`, `isbn:`, `studio:` et `franchise:` (Book `61-75`, Game `61-68`), aujourd'hui non testés. `MediaSearchPanel`, qui a une pagination infinie, reste à part.

**RF-19 — Champs de modération**

- **Constat** : `admin/reports 587-627` et `admin/users/components/DeleteUserModal.svelte:70-111`. Le snippet `fieldError` local de reports (`734-742`) duplique `FieldError.svelte`.
- **Proposition** : `lib/components/admin/ModerationStatementFields.svelte`.

**RF-20 — Classe d'input brute**

- **Constat** : la classe `border-border bg-surface … rounded-lg border px-3 py-2 text-sm` est utilisée au lieu de `.input` (`app.css:180`) dans `reports:595,624`, `DeleteUserModal:68,82,109`, `security:266`, `backup:361`, `EmailTab` et `PushTab`.
- **Proposition** : basculer sur `.input`, après vérification visuelle de l'écart.

**RF-21 — Modals de mot de passe**

- **Constat** : 5 modals identiques dans `settings/components/MfaSection.svelte` : `623-662`, `664-701`, `784-823`, `825-864` et `866-909`.
- **Proposition** : `settings/components/PasswordConfirmModal.svelte`, soit environ 170 lignes de moins.

**RF-22 — Petits composants**

- **Constat** : `SettingsLinkRow` dans `SecuritySection 328-357`, `SettingsNav ≈170-212` et `SettingsSearchResults 42-59` ; `EmptyState` refait dans `ImportWizard 566-575` et `search:341`.

**RF-23 — 🐛 `<img>` brut au lieu de `Poster`**

- **Constat** : `ProfileActivity.svelte:124-134`, `ProfileReviews.svelte:60-72` (dégradé recopié avec d'autres coefficients), `reviews/+page.svelte:292-303` et `ActivityItem.svelte:49`. Aucun de ces sites ne gère le 404, donc une couverture cassée s'affiche en image brisée.
- **Proposition** : `<Poster caption={false}>`, avec éventuellement une prop de teinte.

**RF-24 — Progression des épisodes**

- **Constat** : `EpisodesSection.svelte:143-176` (`unwatchedGapCount`, `daysUntilAir`, `upcomingLabel`) et la page média (`orderedSeasons 285-293`, `upcoming 253-267`).
- **Proposition** : `lib/episode-progress.ts`, avec `now` injecté pour les tests.

**RF-25 — `ImportWizard.svelte` (830 l.)**

- **Proposition** :
  - base64 et signature ZIP (`231-264`) → `lib/import-file.ts`, qui a déjà un spec ;
  - état des décisions (`180-230`, `307-345`) → `import-decisions.svelte.ts` ;
  - mappers (`346-369`) → `import-presentation.ts` ;
  - snippet `groupBody` (`710-830`) → `ImportReviewGroup.svelte`.

**RF-26 — Synchronisation d'édition**

- **Constat** : `books/[id] 178-201`, un effet qui déclenche une mutation.
- **Proposition** : une fonction pure `editionSyncPatch(entry, detail, selected)`, testée.

**RF-27 — `UserDrawer.svelte`**

- **Constat** : `48-172` : six queries et cinq fonctions `switch`.
- **Proposition** : une table `ACTIVITY: Record<kind, { key, fetch, label }>`.

**RF-28 — `LibraryBrowser.svelte` (1062 l.)**

- **Proposition** :
  - état d'URL `152-253` → `library-url-state.ts` ;
  - sélection et annulation `333-432` et `552-598` → `library-selection.svelte.ts` ;
  - navigation clavier `602-677` → `nextFocusIndex` pur.

  Le spec existant protège le refactor.

**RF-29 — `CommentThread.svelte` (1025 l.)**

- **Proposition** :
  - `CommentCard.svelte` (`640-844`) et `CommentActionRow.svelte` (`548-639`) ;
  - `mentionParts` (`346-379`) → `lib/comment-mentions.ts`.

  Le TanStack brut reste dans le parent.

**RF-30 — `MfaSection.svelte` (945 l.)**

- **Proposition** : en plus de RF-21, extraire `MfaTotpSetupModal.svelte` (`538-621`) et `RecoveryCodesModal.svelte` (`181-237`, `911-938`), et réutiliser `lib/download.ts`.

**RF-31 — Découpages faibles**

- landing (`routes/+page.svelte`) : algorithme `stack` `233-253` → `routes/components/landing-stack.ts` + test, et données `23-212` dans un module ;
- `search/+page.svelte` : 238 lignes de `<style>` (`365-603`) ;
- tiroirs admin : `admin/cache 408-586` → `CacheItemDrawer.svelte`, et `UserDrawer 275-662` ;
- `lib/navigation.ts` : desktop `1-189`, mobile `191-459` ;
- `lib/api/admin.ts` → `lib/api/admin/*.ts` ;
- indicateur glissant `DesktopSidebar 91-106` / `SettingsNav 55-96`.

Valeur faible pour l'ensemble.

#### Transverse

**RT-01 — Code mort**

- **Constat** : 4 fonctions ne sont importées que par leur propre spec :
  - `apps/api/src/comments/mention.util.ts:6` (`extractMentions`, le fichier entier, devenu inutile depuis que les mentions sont structurées) ;
  - `common/session-aggregate.util.ts:11` (`gameSessionAggregate`, alors que `bookSessionAggregate` est utilisé) ;
  - `social/visibility.util.ts:74` (`canAccessProfile`) ;
  - `admin/admin-system-stats.util.ts:46` (`shareOrNull`).
- **Proposition** : supprimer ces fonctions et leurs tests.

**RT-02 — Spec orphelin**

- **Constat** : `apps/api/src/gamification/level.util.spec.ts` ; il n'existe plus de `level.util.ts`. Il teste des fonctions de shared déjà couvertes par `packages/shared/src/level.spec.ts`.
- **Proposition** : reporter les seules assertions uniques (les seuils calibrés), puis supprimer le fichier.

**RT-03 — Outillage cassé ou inutile**

- **Constat** :
  - `apps/api/package.json:34` déclare un script `graph` qui pointe vers `scripts/graph.ts`, un fichier **inexistant**.
  - `tsconfig-paths` (`package.json:89`) est inutile : aucun `paths` n'est défini dans les tsconfig.
- **Proposition** : retirer le script, puis la dépendance et les `-r tsconfig-paths/register` (`package.json:29`, `prisma.config.ts:9`).

**RT-04 — Champs d'import hérités**

- **Constat** :
  - `shared/dto/import.ts` : `subtitle` (l.96), `ImportReportTile.sub` (l.159), et `context?` / `id?` encore optionnels « pour d'anciens déploiements ».
  - Le web ne les lit plus, mais l'API produit encore des chaînes **FR/EN en dur** : `steam.source.ts:124,157`, `media-import.source.ts:177,285-298` et `book-csv.source.ts:134,209,213`.
- **Proposition** : supprimer ces champs et rendre `context`/`id` obligatoires. API et web sont déployés ensemble.

**RT-05 — Shims de compatibilité**

- **Constat** : `lib/admin-backup-inventory.ts:6-17` (`LegacyBackupFileDto`, #246) et `lib/api/auth.ts:39-41` (`removeItem("loomkeep.tokens")`, #206).
- **Proposition** : dater ces shims dans un commentaire, puis les retirer.

**RT-06 — `make-zip.ts`**

- **Constat** : `apps/api/src/import/make-zip.ts:3-8` affirme être exclu par `tsconfig.build.json`, ce qui est **faux** : ce dernier n'exclut que `**/*spec.ts`. Le fichier part donc dans `dist/`, alors qu'il ne sert qu'à 3 specs.
- **Proposition** : le déplacer vers `apps/api/test/` ou le renommer en `*.spec-helper.ts`, et corriger le commentaire.

**RT-07 — Barrel `lib/api/client.ts`**

- **Constat** : il se décrit comme « Compatibility barrel », mais **115 à 118 fichiers** l'importent, contre 12 pour `core` et environ 33 en imports directs. Il est incomplet (il ne réexporte pas `links`, `stats`, `session-timer`, etc.), ce qui produit des imports mixtes dans un même fichier (`NotificationBell.svelte:21,29`, `ProfileView.svelte:13-14`, `media/+page.svelte:2,7`).
- **Proposition** : trancher. La recommandation est un codemod vers les modules directs, la suppression de `client.ts` et la mise à jour de la phrase du CLAUDE.md.

**RT-08 — Libs navigateur dans `dependencies`**

- **Constat** : `qr-scanner`, `qrcode`, `svelte-dnd-action`, `socket.io-client`, `unleash-proxy-client`, `@simplewebauthn/browser`, `@tanstack/svelte-query` et les polices sont dans les `dependencies` de `apps/web/package.json`. Avec adapter-node, elles sont copiées dans l'image par `pnpm deploy --prod` (`apps/web/Dockerfile:127`), alors que le commentaire `:107-111` dit que seules shared et sentry sont nécessaires au runtime.
- **Proposition** : les passer en `devDependencies`.
- **Risque** : moyen. Il faut valider `docker build` puis `node build`, notamment pour svelte-query en SSR.

**RT-09 — `@simplewebauthn/browser` dans shared**

- **Constat** : c'est une devDependency de shared, alors que `dto/auth.ts:1-6` publie ses types. Les consommateurs ne la déclarent pas, donc avec `skipLibCheck` le type devient `any` en silence.
- **Proposition** : la déclarer en `peerDependency`, ou recopier les 4 types JSON.

**RT-10 — Version d'`apps/docs`**

- **Constat** : `apps/docs/package.json:3` est en `1.9.0`, alors que les autres paquets sont en `1.10.0`. Ni le CLAUDE.md (« quatre package.json ») ni le skill `version-bump` ne listent docs.
- **Proposition** : l'inclure dans le lockstep, ou l'exclure explicitement par écrit.

**RT-11 — `minimumReleaseAgeExclude`**

- **Constat** : dans `pnpm-workspace.yaml`, environ 75 entrées absentes du lockfile (typescript 7.0.2 et ses 20 binaires, vite 8.1.3, eslint 10.10.0, `@sentry/*` 10.73.0, `@swc/*` 1.16.2…). Le commentaire de l'override `fastify` cite 5.12.3, alors que l'API est en ^5.12.5.
- **Proposition** : purger les entrées obsolètes et mettre le commentaire à jour.

**RT-12 — knip**

- **Constat** : `.knip.json` déclare `"ignoreDependencies": ["rxjs"]` sur le workspace racine, qui n'a pas `rxjs` (c'est `apps/api` qui l'a).
- **Proposition** : vérifier avec `pnpm knip` en local, puis déplacer ou supprimer.

**RT-13 — Configs vitest**

- **Constat** :
  - `apps/api/vitest.config.mts:5-15` et `vitest.config.e2e.mts:5-15` ont un bloc swc identique.
  - Le bloc de couverture est répété dans 4 configs.
  - `packages/shared/vitest.config.mts:12` **n'exclut pas** les specs de la couverture.
- **Proposition** : `mergeConfig` pour l'e2e, et ajouter l'exclusion dans shared.

**RT-14 — Sévérité ESLint**

- **Constat** : `apps/web/eslint.config.mjs:52-55` passe `no-unused-vars` en `error`, alors que la base (`eslint.config.base.mjs:59`) le met en `warn`.
- **Proposition** : unifier dans la base.

**RT-15 — Style de test**

- **Constat** : l'API a `globals: true`, mais 16 specs sur 206 importent quand même `describe`/`it` depuis `vitest`.
- **Proposition** : uniformiser.

**RT-16 — Fichiers en camelCase**

- **Constat** : `lib/backNav.svelte.ts`, `lib/navStyle.svelte.ts`, `lib/queryClient.ts` et `lib/actions/{dialogFocus,flipChildren,scrollLock}.ts`, alors que le reste est en kebab-case.
- **Proposition** : les renommer (environ 23 imports à toucher). Sous Windows, `git mv` doit se faire en deux temps.

**RT-17 — `lib/` à plat**

- **Constat** : 76 fichiers à la racine de `lib/`.
- **Proposition** : `lib/{admin,review,library,nav,preferences,app,share,utils}/`, en déplaçant les specs avec leur source.
- **Risque** : gros diff d'imports, donc une PR mécanique dédiée. Mettre à jour les chemins cités dans le CLAUDE.md.

**RT-18 — `components/` à plat**

- **Constat** : environ 120 composants à plat, avec des modules `.ts` de logique au même niveau.
- **Proposition** : `components/{library,review,list,comments,overlay,session}/`.

**RT-19 — Deux fichiers `domains.ts`**

- **Constat** : `lib/domains.ts` (logique) et `lib/constants/domains.ts` (`DOMAINS`) portent le même nom.
- **Proposition** : renommer le premier en `domain-availability.ts`.

**RT-20 — Nommage côté import**

- **Constat** :
  - parseurs d'import en `<x>-parse.ts` (books) contre `parse-<x>.ts` (simkl, trakt, myanimelist, tvtime) ;
  - CSV réparti entre `import/csv.ts` (`parseCsv`) et `common/csv.util.ts` (`toCsv`) ;
  - `public-api/v1/mappers.ts` contre `*.mapper.ts` ailleurs.
- **Proposition** : `<source>.parser.ts`, réunir le CSV dans `common/csv.util.ts`, et renommer en `v1.mapper.ts`.

**RT-21 — Specs par fonctionnalité**

- **Constat** : `library/upcoming-movie.spec.ts` et `reviews/upcoming-movie.spec.ts` (même nom dans deux domaines), `library/movie-calendar.spec.ts` et `notifications/movie-release.spec.ts`.
- **Proposition** : adopter `<service>.<feature>.spec.ts`.

**RT-22 — Exports inutiles**

- **Constat** : 48 côté API (par exemple `mail.service.ts:19,29,53,83,173`, `responses.dto.ts:42…`) et 19 côté web.
- **Proposition** : retirer `export`. Cosmétique.

**RT-23 — `shared/enums.ts` (858 l.)**

- **Constat** : le fichier mélange enums, constantes et logique.
  - La logique report (l.527-800, avec `reportMotifsFor` et `isReportCategoryAllowed`) a déjà son spec, `report-categories.spec.ts`, mais pas de fichier source correspondant.
  - Des constantes non-enum : `REVIEW_TEXT_MAX_LENGTH` (452), `COMMENT_TEXT_MAX_LENGTH` (518) et des seuils (521, 524).
- **Proposition** : `report-categories.ts`, et ranger les constantes dans `dto/review.ts` / `dto/comment.ts`. Le barrel reste inchangé.

**RT-24 — `Locale`**

- **Constat** : défini dans `enums.ts:820-821`, alors que `locale.ts` l'importe. Ce n'est pas un enum Prisma.
- **Proposition** : le déplacer dans `locale.ts`, et fusionner le commentaire en doublon de `enums.ts:822-830`.

**RT-25 — `shared/dto/admin.ts` (618 l.)**

- **Proposition** : le découper en `admin-{services,comms,jobs,cache,users,backups}.ts`. Les résumés iraient dans `admin-stats.ts`. `PublicStatsSummaryDto` (l.610) n'est pas un DTO admin.

**RT-26 — Commentaires faux ou orphelins, à corriger**

- `admin/admin-cache.controller.ts:450-455` : « games/books/music don't yet », faux.
- `admin/admin-catalogue-stats.service.ts:18-20` : affirme qu'il n'y a pas de cron, faux (voir CB-02).
- `main.ts:181` : « Swagger UI on /docs », alors que le chemin réel est `swagger` (l.200).
- `library.service.ts:464-470` et `1566-1572` : JSDoc empilées sur la mauvaise méthode.
- `routes/app/lists/[id]/+page.svelte:214-217` : commentaire orphelin.
- `books/[id]/+page.svelte:149-151` : obsolète.
- `make-zip.ts:3-8` : voir RT-06.
- **CLAUDE.md** : affirme que le web dérive la clé i18n via `errorCodeToMessageKey()`, alors que le web utilise une map explicite `MESSAGES` (`lib/api/errors.ts:13,320`) et que la fonction ne sert qu'aux specs.

**RT-27 — Docs et Dockerfiles**

- **Constat** :
  - `apps/docs/src/components/AlertTable.astro:11` importe shared par chemin relatif profond.
  - `apps/api/Dockerfile:6-7` affirme que tous les manifestes sont requis, alors que `apps/docs/package.json` n'est pas copié.
- **Proposition** : un alias ou un commentaire pour l'import, et corriger le commentaire du Dockerfile.

**RT-28 — 🐛 `detectLocale` ignore l'italien**

- **Constat** : `auth/auth.service.ts:1129-1132` renvoie `"fr"` ou `"en"` seulement, alors que l'italien est une locale supportée.
- **Proposition** : s'appuyer sur la liste `Locale` de shared. C'est un bug hors refactor, mais révélé par l'axe 1.

---

## 5. Quick wins

Pistes à fort rendement et faible effort (S, risque faible), à traiter en premier. Les bugs passent avant le reste.

| #   | ID                             | Pourquoi                                                        |
| --- | ------------------------------ | --------------------------------------------------------------- |
| 1   | SH-05 + HB-20 (première étape) | 🐛 liens morts dans les listes et les stats ; `workPath` unique |
| 2   | SH-01, SH-02, SH-24            | constantes déjà dans shared, ou à une ligne d'y être            |
| 3   | SH-06, CF-10, RT-28            | incohérences de texte visibles (S1E2, Anime/Animé, italien)     |
| 4   | HB-03                          | timeouts sur 8 `fetch`, dont le login                           |
| 5   | CB-02, CB-03                   | constantes critiques (TTL catalogue, durée de vie des tokens)   |
| 6   | RT-01, RT-02, RT-03            | suppression pure de code mort                                   |
| 7   | RF-12, RF-21                   | 11 boutons et 5 modals → 2 composants                           |
| 8   | CF-08, TF-08                   | source unique des domaines ; clés de badge typées               |
| 9   | SH-15                          | contrat realtime corrigé (`jobId`)                              |

---

## 6. Plan d'exécution

Chaque lot correspond à une PR mergeable seule. Le numéro d'ordre indique les dépendances. Les lots marqués ∥ sont parallélisables.

| Lot        | Contenu                                                                                                                               | Dépend de                            | Remarques                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| **L0a** 🐛 | SH-05 côté API seulement : `workPath` dans `common/work-href.util.ts`, branché dans `list.service` et `stats.service`                 | —                                    | Test rouge d'abord. Minimal, pour corriger vite.               |
| **L0d** 🐛 | HB-03 + reliquat HB-01 (voir §7, HB-02)                                                                                               | —                                    | Specs des providers.                                           |
| **L0f** 🐛 | Front : SH-24, RF-23                                                                                                                  | —                                    | Tests unitaires et de composant.                               |
| **L0g** 🐛 | Textes : SH-06, CF-10, RT-28, HB-05, HB-13, SH-27 (filtre serveur et import)                                                          | —                                    |                                                                |
| **L1** ∥   | Nettoyage : RT-01, RT-02, RT-03, RT-06, RT-11, RT-12, RT-13, RT-14, RT-26, SH-38 (`XP_RULE_LIST`)                                     | —                                    | Aucun risque fonctionnel.                                      |
| **L2**     | shared, constantes de contrat : SH-01, 02, 03, 17, 18, 19, 20, 21, 28, 30, 31 + SH-29/CB-01 (`shared/date.ts`)                        | —                                    | Un seul `build:package`.                                       |
| **L3**     | shared, routes et présentation : SH-05 complet (`shared/routes.ts`, migration de L0a et du web), SH-06, 07, 08, HF-07                 | L0a                                  | Supprime `home/widgets/media.ts`.                              |
| **L4**     | shared, unions : SH-09, 10, 11, 12, 13, 14, 15, 16, 22, 23, 25, 26, SH-32                                                             | L2                                   | Typage des `List*Filters` web.                                 |
| **L5** ∥   | API `common/` : HB-06 à HB-12, HB-15 à HB-18, HB-21 à HB-25, HB-27 à HB-29                                                            | L2 (pour `DAY_MS`)                   | Plusieurs petites PR possibles (date, crypto, pagination).     |
| **L6** ∥   | API constantes : CB-02 à CB-09                                                                                                        | —                                    |                                                                |
| **L7** ∥   | API types : TB-01 à TB-10                                                                                                             | —                                    | TB-04 avec HB-15.                                              |
| **L8**     | API services transverses : HB-20 (`resolveWorkTargets`), RB-18, RB-03, RB-04, RB-06, RB-07, RB-08, RB-09, RB-11 à RB-13, HB-26, HB-30 | L3, L5                               | Une PR par thème.                                              |
| **L9**     | API admin : RB-14, RB-15, RB-16, RB-17, RB-19                                                                                         | L5, L8                               | RB-19 après décision sur la maintenance.                       |
| **L10**    | API découpages : RB-10, RB-20 à RB-30                                                                                                 | L8 (RB-23, RB-24, RB-28 après HB-20) | Une PR par fichier, sans changement de comportement.           |
| **L11** ∥  | Web helpers : HF-02, 03, 05, 06, 08 (par lots), 09 à 20                                                                               | L2 pour HF-05                        | HF-08 en plusieurs PR.                                         |
| **L12** ∥  | Web constantes : CF-01 à CF-14                                                                                                        | —                                    | CF-03 en dernier, progressif.                                  |
| **L13** ∥  | Web types : TF-01 à TF-14                                                                                                             | L12 (TF-09, TF-11)                   |                                                                |
| **L14**    | Web petits composants : RF-03, 04, 05, 07, 09 à 17, 19 à 22                                                                           | L12                                  |                                                                |
| **L15**    | Web gros composants : RF-01 (avec test de caractérisation), RF-02, RF-06, RF-18                                                       | L3, L14                              | Une PR par composant.                                          |
| **L16**    | Web découpages : RF-24 à RF-31                                                                                                        | L15 pour RF-25                       |                                                                |
| **L17**    | Déplacements « shared → app » : SH-33, 34, 35, 36, 37, 39, 40 + RT-04, RT-23, RT-24, RT-25                                            | décision SH-35                       |                                                                |
| **L18**    | Dépendances et build : RT-08, RT-09, RT-10                                                                                            | —                                    | RT-08 demande un `docker build`.                               |
| **L19**    | Structure (mécanique, en dernier) : RT-07 (codemod `client.ts`), RT-16, RT-17, RT-18, RT-19, RT-20, RT-21, RT-22                      | tout le reste                        | Conflits garantis avec les PR en cours ; à faire seul et vite. |

**Décisions à prendre avant les lots concernés** :

- **SH-04** : sort de la note 0 dans l'histogramme.
- **SH-08** : sémantique du pourcentage de lecture.
- **SH-35** : règle d'appartenance à shared.
- **SH-38** : `XP_RULES` côté web ou non.
- **RB-09** : absence de cron music, voulue ou non.
- **RB-19** : maintenance bloquant les mutations ou non.
- **RT-07** : codemod du barrel ou assumer le point d'entrée.
- **RT-10** : docs dans le lockstep de version ou non.
- **Écart d'XP** : games et books révoquent l'XP en quittant l'état terminal, media (`MOVIE_WATCHED`) et music (`ALBUM_LISTENED`) non. La réconciliation nocturne absorbe probablement l'écart, mais c'est une incohérence de règle.

---

## 7. Repères des tâches résolues

Ces numéros restent uniquement pour guider les pistes qui en dépendent ; ils ne font plus partie des tâches à traiter.

- **HB-02** : Open Library et MusicBrainz utilisent désormais `common/http.util.ts` → `fetchJson` (timeout, retries, erreurs réseau en 502, vrais 404 conservés). MusicBrainz attend son throttle avant chaque tentative et ne réessaie les réponses HTTP que sur 503 ; les quotas comptent chaque requête. Pour HB-01, seuls les `sleep` du helper HTTP et du throttle restent à mutualiser. HB-03 conserve les autres appels `fetch` bruts, notamment Cover Art Archive.
- **HF-04** : `localDateInput` vit dans `lib/date.ts`, avec un réexport dans `session-presentation.ts`. Il sert aux dates de sortie, à la borne de naissance, au calendrier, aux clés API et à OnThisDay. SH-29 pourra déplacer cette source unique vers shared ; HF-05 pourra compléter ce module avec les calculs de jours calendaires.

---

## 8. Points écartés

| Sujet examiné                                                                                                                                             | Raison du rejet                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classe de base commune aux 4 services de bibliothèque                                                                                                     | Le raisonnement en tête de `entry-lifecycle.util.ts` tient : MEDIA diverge sur presque chaque appel Prisma. Les helpers libres sont le bon niveau. |
| Fusion de `syncPlaythroughStatus` / `syncReadingStatus` ; classe de base `*-item`                                                                         | Les delegates Prisma génériques imposent des casts : le coût de typage dépasse le gain. On n'extrait que les tables et le TTL (RB-05, RB-09).      |
| `admin.service.ts:82-356` (getter de 275 l.)                                                                                                              | Table déclarative de sondes (`specs`) : une donnée, pas une logique.                                                                               |
| `users.controller.ts`, `books.controller.ts`                                                                                                              | Fins ; hors RB-19, rien à sortir.                                                                                                                  |
| `ParseUUIDPipe` / `ParseIntPipe` sur les ids                                                                                                              | Les ids sont des cuid ; le 404 du service suffit.                                                                                                  |
| `health.controller`, `public-stats.controller` (Prisma direct)                                                                                            | Triviaux, acceptables.                                                                                                                             |
| Helper `uniq` (`[...new Set()]` ≈26 fois), `trim() \|\| null`                                                                                             | Idiomatique ; un helper n'apporterait que de l'indirection.                                                                                        |
| `splitAuthors` ×3, `parseYear`, `toIsoDate` ×3, `pickTrailer`, `toRatings`                                                                                | Entrées hétérogènes selon le provider : ce n'est pas la même logique.                                                                              |
| `toDateOrNull` de tvtime, `earliest(dates[])` de profile-stats                                                                                            | Sémantique différente (fuseau, arité).                                                                                                             |
| `CACHE_TTL_MS = 30_000` ×2, `MIN_REQUEST_INTERVAL_MS` par provider, `WATCH_LIST_TTL_MS`, cron `EVERY_6_HOURS` ×3                                          | Réglages indépendants, volontairement locaux.                                                                                                      |
| `createHash` dans `auth-cookies.ts:135`                                                                                                                   | Dérivation de clé, pas un hash de token.                                                                                                           |
| `getCalendar` et son repli `movieReleaseRegion`                                                                                                           | Différence voulue (RB-12).                                                                                                                         |
| Partager `deriveStatus`, libellés de statut, textes de notification                                                                                       | Le web ne recalcule pas le statut ; il y a deux systèmes i18n distincts (Paraglide et `notification-copy.ts`).                                     |
| `COPY_LOCALES` ↔ `Locale`                                                                                                                                 | Sous-ensemble voulu (langues de rédaction de l'API).                                                                                               |
| `format.ts` du web dans shared                                                                                                                            | Intl + Paraglide, propre au web ; l'API ne formate pas de durées.                                                                                  |
| Tailles de page `20` du web dans une constante commune                                                                                                    | Les deux sites (`ToWatchWidget`, `UserSelector`) n'ont pas le même sens ; SH-30 ne vise que la pagination réelle.                                  |
| Unions `type Tab` / `Step` / `Mode` homonymes                                                                                                             | Les valeurs diffèrent ; elles sont propres à chaque écran.                                                                                         |
| Enums utilisés à l'exécution par l'API seule (`XpReason`, `ActivityType`…)                                                                                | Vocabulaire des DTO, consommé comme types par le web : ils sont à leur place.                                                                      |
| Seuils numériques réservés à l'API dans shared (`GHOST_AFTER_DAYS`, `MAX_API_KEYS_PER_USER`…)                                                             | Coût nul ; certains sont utiles au web (SH-40).                                                                                                    |
| `LEVEL_BASE/STEP/CAP_COST`, `VALIDATION_CONSTRAINT_NAMES`, `REPORT_CATEGORY_MOTIFS` exportés pour les tests                                               | Pattern « exporter pour tester », assumé (`@public`).                                                                                              |
| `VALERR_MESSAGE_KEYS`, les 47 `check*` de `registry.ts` exportés                                                                                          | Même raison.                                                                                                                                       |
| `legacyIncomplete`, `settings/nav.ts` `legacyHash`, `notification-presentation.ts:24`                                                                     | Donnée métier persistée, ou redirection de favoris : ce n'est pas du code mort.                                                                    |
| `apps/api/test/__snapshots__`                                                                                                                             | La règle « no snapshot » ne vise que le web.                                                                                                       |
| `settings/nav.ts` (826 l.)                                                                                                                                | Données déclaratives, source unique volontaire.                                                                                                    |
| Pages légales (865 et 515 l.), `admin/components/+page.svelte` (747 l.)                                                                                   | Prose, et vitrine du design system.                                                                                                                |
| `HomeLayoutEditor` (718 l.)                                                                                                                               | Les maths de grille sont déjà dans `lib/home/grid.ts` ; le reste est de la colle DOM.                                                              |
| Hero de la page média                                                                                                                                     | Design en overlay volontairement distinct (RF-02).                                                                                                 |
| Sélecteurs de domaine (onboarding contre réglages), tuiles et chips `aria-pressed`                                                                        | Visuels différents ; la logique `domainToggle` et la classe `.chip` sont déjà partagées.                                                           |
| `AdminList` générique (reports, security, imports)                                                                                                        | Sur-ingénierie ; on se limite à RF-12, RF-14 et RF-15.                                                                                             |
| `CommentThread` en TanStack brut                                                                                                                          | Exception documentée (seules les clés sont concernées, RF-11).                                                                                     |
| try/catch légitimes du web (scan ISBN, `QuickAddPanel` parsing d'URL, `safeRedirect`, `navigator.share`, Mermaid, rollback optimiste de `LibraryBrowser`) | API d'appareil ou de navigateur, ou logique optimiste, et non des appels à l'API.                                                                  |
| `Intl.DateTimeFormat`, `downloadBlob`, `staleTime`, z-index, durées de toast                                                                              | Déjà centralisés.                                                                                                                                  |
| URLs d'images TMDB/IGDB côté web                                                                                                                          | Seulement dans `landing-mock-data.ts` ; le web reçoit des URLs complètes.                                                                          |
| `Math.round(x / 60)` des stats, `padStart` décoratifs                                                                                                     | Valeurs numériques de graphique ou effet visuel ponctuel.                                                                                          |
| `mailto:contact@loomkeep.app` des pages légales                                                                                                           | Contenu juridique figé.                                                                                                                            |
| `as unknown as` WebAuthn du web, `Component<any>` des utilitaires de test                                                                                 | Documentés, et pattern standard.                                                                                                                   |
| `COMPACT_QUERY` de `layout.svelte.ts`                                                                                                                     | Différente à dessein (largeur ou hauteur).                                                                                                         |
| ESLint et tsconfig                                                                                                                                        | Déjà factorisés via les configs `base`.                                                                                                            |
| Versions de vitest, coverage, typescript et `@types/node`                                                                                                 | Homogènes.                                                                                                                                         |
| `prisma` en `dependencies`, `@fastify/static` en dev, `pino-http`, `rxjs`, `@nestjs/schematics`, `dotenv`                                                 | Justifiés (runtime de migration, Swagger réservé au dev, peers).                                                                                   |
| APIs Node dans shared                                                                                                                                     | Aucune trouvée : sain.                                                                                                                             |
| Barrel `shared/index.ts` (50 `export *`)                                                                                                                  | Cohérent ; l'impact sur le tree-shaking est négligeable pour des constantes (attention seulement aux gros objets, SH-38).                          |
| `ownershipSource: "Steam"` import ↔ préréglage web                                                                                                        | Couplage implicite mais stable ; gain marginal.                                                                                                    |
| Domaine des sources d'import (web) contre classes de base (API)                                                                                           | Structurel côté API ; une table partagée ferait doublon.                                                                                           |
