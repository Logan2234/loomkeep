---
name: add-locale
description: Add a new UI language to Loomkeep (web catalogs, shared Locale list, regional variant, API emails/push/feeds). Use when Logan asks to "ajouter une langue", "traduire l'app en <langue>", "add Spanish/German/…", or to refresh an existing locale after new keys landed.
---

# Adding a language

Italian (`it`) was the first language added this way — use it as the reference
implementation (`git log --oneline -- apps/web/messages/it`).

English (`en`) is the source; French (`fr`) is written alongside it with every
change. Any other locale is translated from English and may lag: a missing key
falls back to English at compile time, key by key, so a partial locale never
breaks the app.

## 1. Translate the web catalogs

see files: `apps/web/messages/en/*.json`
(~3 000 keys over seven files; the largest are `other.json` ~1 170, `admin.json` ~620
and `settings.json` ~380). Produce `apps/web/messages/<code>/` with the
same file names.

- Translate from English, glance at French when the English is terse or ambiguous.
- Keep every key, the `$schema` line, and every `{placeholder}` exactly — a test
  rejects a translation whose placeholders differ from English.
- Informal address (the French copy uses _tu_): pick the equivalent register.
- Some messages are sentence **fragments** stitched around a link, a code span or
  an icon in the template (keys ending `_prefix`, `_suffix`, `_middle`, `_intro`,
  `_trail`, or `admin_backup_restore_*`). Check the call site before reordering
  words — the surrounding pieces don't move.
- Keep in English, verbatim: `datasource_tmdb_notice`, `datasource_igdb_notice`
  (attribution wording required by the providers), nav style names ("Marquee",
  "Dock"), and third-party UI paths (e.g. Goodreads' "My Books → Import and export").
- `{noun}` placeholders receive a lowercase singular noun from `common_*`
  (`common_game`, `common_book`…): check gender agreement in languages that need it.
- Product vocabulary — keep it consistent across all files:

  | Concept                    | fr                  | en                | it                      |
  | -------------------------- | ------------------- | ----------------- | ----------------------- |
  | Privacy mode "ghost"       | Figurant            | Ghost             | Comparsa                |
  | Welcome checklist          | Première séance     | First Session     | Prima visione           |
  | Planned (video)            | À voir              | To watch          | Da vedere               |
  | Completed / Dropped        | Terminé / Abandonné | Completed/Dropped | Terminato / Abbandonato |
  | Library                    | Bibliothèque        | Library           | Libreria                |
  | Ownership                  | Possession          | Ownership         | Possesso                |
  | Showcase (equipped badges) | Vitrine             | Showcase          | Vetrina                 |

Work file by file, in chunks of ~300 lines for the large files, writing chunk files to
the scratchpad, then merge and validate them in English key order with this check
(run it before copying anything into `apps/web/messages/`):

```python
import json, re, sys
en = json.load(open(f"apps/web/messages/en/{name}.json", encoding="utf-8"))
xx = json.load(open(f"apps/web/messages/{code}/{name}.json", encoding="utf-8"))
params = lambda s: sorted(set(re.findall(r"\{\w+\}", s)))
missing = [k for k in en if k not in xx]
extra = [k for k in xx if k not in en]
bad = [k for k in en if k in xx and params(en[k]) != params(xx[k])]
assert not (missing or extra or bad), (missing, extra, bad)
```

## 2. Declare the locale (two lists, kept equal by a test)

- `apps/web/project.inlang/settings.json` → `locales`
- `packages/shared/src/enums.ts` → `Locale`, then `pnpm build:package`

Everything else follows from these: language pickers (settings, onboarding, site
footer — each language is shown in its own name via `Intl.DisplayNames`), API
validation of `user.locale`, the admin email preview, the PWA manifest.

## 3. Regional variant

`LOCALE_REGIONS` in `packages/shared/src/locale.ts` (`it: "it-IT"`). It drives date
and number formatting on the web and the language TMDB answers in. Without an
entry the bare code is used, which works but loses regional formatting.

## 4. API copy (emails, push, notifications, RSS feeds)

Add the code to `COPY_LOCALES` in `apps/api/src/common/copy-locale.util.ts`: the
compiler then lists every table missing it. Today:

- `apps/api/src/mail/mail.i18n.ts` — `MAIL_COPY` (~165 lines per locale, with
  functions for plurals and interpolation)
- `apps/api/src/notifications/notification-copy.ts` — `COPY`
- `apps/api/src/ee/calendar/calendar-feed.service.ts` — `FEED_COPY`
- `apps/api/src/ee/social/activity-feed.service.ts` — `FEED_COPY` (verbs + phrases)

Skipping this step is valid: a shipped locale without API copy receives English.

## 5. Out of scope

- Legal pages (`apps/web/src/routes/legal/*`) stay in French: that version is the
  one that is legally binding.
- IGDB, AniList and Open Library return English-only metadata; only TMDB follows
  the locale.
- Plurals are separate `_one` / `_many` keys. Fine for Romance and Germanic
  languages; Slavic languages (few/many forms) would need Paraglide variants first.

## 6. Verify and hand over

- Run `pnpm --filter @loomkeep/web generate:paraglide`, then the catalog and locale
  tests: `pnpm --filter @loomkeep/web exec vitest run src/catalogs.spec.ts src/lib/locales.spec.ts`
  and, if step 4 was done, the API `src/common src/mail src/notifications src/ee` tests.
- Update `src/lib/locales.spec.ts` (the options list) and
  `packages/shared/src/locale.spec.ts` / `copy-locale.util.spec.ts` for the new code.
- A running dev server keeps a stale pre-bundle of `@loomkeep/shared`: after
  `build:package`, restart `pnpm dev` (delete `apps/web/node_modules/.vite` if the
  app renders blank with "… is not a function").
- Tell Logan what to check: switch to the language in Settings → Appearance and
  browse home, a library, a detail page and settings; preview an email in Admin →
  Communications; switch back afterwards (the locale is saved on the account).

## Refreshing an existing locale

After features land, a non-base locale falls behind (untranslated keys show in
English). Diff its keys against `en`, translate only the missing ones, validate
with the check above.
