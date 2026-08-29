# Plan — Centralized API layer (`createApiQuery` / `createApiMutation` / `createApiInfiniteQuery`)

Implementation plan for the Quackback ticket _"Centralized API layer:
createApiQuery / createApiMutation / paged helper"_
(`post_01m14vjtqeecw9tc2ajm79dqcc`). Written to be executed by an agent
starting with no prior context.

**The design decisions in §2 are settled.** They came out of a long design
discussion; do not re-open them mid-implementation. If something in §2 turns
out to be impossible in practice, stop and report rather than silently
picking an alternative.

---

## 1. Why

Audit of `apps/web` at the time of writing:

| Measure                                                   | Value                         |
| --------------------------------------------------------- | ----------------------------- |
| Files importing `$lib/api/client`                         | 71                            |
| Files using `resolveApiError`                             | 56 (110 non-spec occurrences) |
| **Files calling the API with no error resolution at all** | **27**                        |
| `$effect` in `.svelte`                                    | 109                           |
| `error = $state` / `loading = $state`                     | 38 / 29                       |
| `AbortController` anywhere in `apps/web`                  | 0                             |

Every API call site today is `try { await route(...) } catch (err) { error =
resolveApiError(err); }`, written by hand. Nothing forces it, and three call
sites have already regressed:

- `routes/app/feed/+page.svelte:15` — `getFeed().then(...).finally(...)`, no
  `.catch()`. On failure: an unhandled rejection, and the user sees the
  **empty state** ("nobody you follow has done anything") instead of an error.
- `lib/components/ProfileReviews.svelte:29` — `.catch(() => (reviews = []))`.
  A failure renders as "no reviews".
- `routes/app/media/+page.svelte:50` — `toast.error("Mise à jour
impossible")`, a hardcoded French string bypassing both the error-code
  convention and Paraglide.

The goal is to make the error path structural: helpers that resolve the error
themselves, so there is no `try/catch` left to forget.

## 2. Settled decisions

1. **Build on `@tanstack/svelte-query`** (v6.1.38, runes-native, already a
   dependency; `QueryClientProvider` already mounted in
   `apps/web/src/routes/+layout.svelte:37`). No bespoke `useApiCall`:
   cancellation, dedup, staleness, refetch-on-focus and retry all come from
   the library, and hand-rolling a subset would mean migrating twice.
2. **Two levels, not two paradigms.** The helpers cover the simple cases.
   Screens needing something the helpers do not express keep using TanStack
   directly — `lib/components/CommentThread.svelte` is the reference for that
   and is **not** migrated.
3. **Identical surface on every helper: `data` / `error` / `loading`.**
   `error` is always a translated `string | null`, never a raw `ApiError`.
4. **`error` is computed with `bannerMessage()`** on `createApiMutation`, not
   `resolveApiError()` directly — see §3.
5. **`fieldErrors`/`coveredFields` exist only on `createApiMutation`**,
   always on there, never an option. **Amended mid-implementation**
   (2026-08-28, Logan, during Phase 3): originally spec'd as part of every
   helper's shared shape; dropped from `createApiQuery`/
   `createApiInfiniteQuery` because a GET has no submitted body for the
   server to return per-field `validation.failed` details against — the
   surface was identical for uniformity's sake, not because it did anything
   on a read. Those two now compute `error` with `resolveApiError()`
   directly (no `bannerMessage`/`coveredFields`).
6. **Mutations are triggered with `mutate(args)`.**
7. **Global `staleTime: 30_000`**; no separate `refetchOnFocus` option, and,
   per an amendment during Phase 3 (see §3), no per-call-site `staleTime`
   override either — it's the one global value everywhere.
8. **`keepPreviousData` defaults to `false`**, opt-in per screen.
9. **Query keys come from a factory** (`lib/api/keys.ts`). `invalidates`
   accepts factory keys only — never bare domain strings.
10. **Invalidate only what is displayed at the same time as the mutation**,
    not everything the mutation semantically touches.
11. **Third helper is `createApiInfiniteQuery`, with no mode flag.**
12. **`statsResource()` and `createLibraryEntryActions()` are resorbed.**
13. **All call sites migrate**, not only the broken ones — the point is a
    single unified pattern.

## 3. Target API

### Shared shape

Every helper returns an object with getters (the TanStack query object is
already reactive; the wrapper delegates to it — see
`lib/components/stats/stats-resource.svelte.ts` for the getter idiom):

```ts
{
  data: T | null,
  error: string | null,        // translated
  loading: boolean,
}
```

`createApiQuery`/`createApiInfiniteQuery` compute `error` with
`resolveApiError(err)` directly. `createApiMutation` alone adds
`fieldErrors: Record<string, string>` and computes `error` with
`bannerMessage(err, coveredFields)` instead — see below.

**`bannerMessage(err, coveredFields)`**, from `lib/api/validation-messages.ts`,
returns `null` when every `validation.failed` detail is displayed under an
input via `fieldError()`, which avoids showing the same message twice on a
form. With `coveredFields` empty it behaves exactly like `resolveApiError`.
`fieldErrors` is built from `fieldError(err, field)` in the same module. Do
not reimplement either function.

### `createApiQuery`

```ts
const feed = createApiQuery(() => ({
  key: keys.feed.all(),
  fetch: () => getFeed(),
}));
```

| Option             | Default      | Role                                                |
| ------------------ | ------------ | --------------------------------------------------- |
| `key`              | **required** | factory key                                         |
| `fetch`            | **required** | the route function call                             |
| `enabled`          | `true`       | don't fetch until a condition holds                 |
| `refetchInterval`  | `false`      | polling                                             |
| `keepPreviousData` | `false`      | opt-in                                              |
| `retry`            | global `1`   |                                                     |
| `onError`          | —            | extra side effect; the error is resolved either way |
| `errorToast`       | `false`      | surface the error as a toast                        |

**No `refetchOnFocus` option, and no per-call-site `staleTime` override either
— dropped mid-implementation** (2026-08-28, Logan, during Phase 3): the plan
originally spec'd `staleTime` as an overridable option, defaulting to the
global 30s. Nothing across Phases 1–3 ever overrode it, so the knob was
speculative — the global `staleTime: 30_000` (queryClient.ts) is now the only
one, non-overridable. It still doubles as the refetch-on-focus knob:
`Infinity` = never refetch on focus, `0` = refetch on every focus, `30_000` =
refetch only if the data is older than 30s. Counts from the last successful
fetch, not from when focus was lost — practically identical for alt-tab
behaviour. `retry` stays overridable — plausible even if unused so far (e.g.
not retrying against a flaky external catalog search).

`keepPreviousData` is `false` by default because it is only correct when a
key change means _same subject, different view_ (filters, sort, page,
search). When a key change means _different subject_ it is a bug: in
`admin/users`, selecting user B would show user A's sessions in B's panel —
a panel carrying "Revoke" buttons. Opt in only on `LibraryBrowser`, the four
search panels, and the `admin/users` **list** (never the selected-user
detail).

### `createApiMutation`

```ts
const changePlan = createApiMutation(() => ({
  mutate: (plan: PlanDto) => updateAdminUserPlan(selected.id, plan),
  onSuccess: (res) => {
    selected = { ...selected, plan: res.plan };
  },
  invalidates: [keys.admin.users()],
}));
// template: onclick={() => changePlan.mutate("PREMIUM")}
//           disabled={changePlan.loading}
```

| Option                   | Default             | Role                                                                                                                                           |
| ------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `mutate`                 | **required**        | the route function call                                                                                                                        |
| `onSuccess(data)`        | —                   | local update, close a modal, navigate                                                                                                          |
| `invalidates`            | `[]`                | factory keys to refresh after success                                                                                                          |
| `successToast`           | —                   | success message, **via `m()`**, never a literal — a string or a `(data, args) => string` function for a message the fixed string can't express |
| `resetErrorOnRun`        | `true`              | clear `error` when triggered                                                                                                                   |
| `coveredFields`          | `[]`                | passed to `bannerMessage`/`fieldErrors` — mutation-only, see §3's shared-shape note                                                            |
| `onError` / `errorToast` | as `createApiQuery` |                                                                                                                                                |

`mutate()` **ignores the call when one is already in flight** — the
double-submit guard (`LibraryBrowser.svelte:155`) moves into the helper and
is never written by hand again.

### `createApiInfiniteQuery`

Wraps `createInfiniteQuery`. Supports **both** server paging styles, since
both exist in the app:

- cursor — `feed`, `ProfileActivity` (`nextCursor`)
- page number — `admin/users`, `admin/cache`, `admin/security` (`hasMore`
  derived from `res.items.length === PAGE_SIZE`)

That choice is expressed by the option computing the next page param, **not**
by a mode flag.

There is deliberately **no accumulate-vs-replace flag**. Every paginated list
in the app accumulates (`MediaSearchPanel:169`, `LibraryBrowser:183`,
`admin/users:145`, `admin/cache:80`, `admin/security:69`, `feed:29` — all
`[...items, ...res.items]`); no classic prev/next pagination exists anywhere.
And it should not be added later either: replace-pagination is `createQuery`
while accumulation is `createInfiniteQuery`, two different primitives, so a
flag would switch implementations behind one API. A classic paginated table,
if one ever appears, needs no helper — `createApiQuery` with the page in the
key plus `keepPreviousData: true` already is that.

"Infinite" means accumulating pages, not a scroll mechanism: some call sites
use an `IntersectionObserver` sentinel, others a "load more" button. The
trigger stays the component's business.

Exposes `data` / `error` / `loading` plus the paging surface
(`hasNextPage`, `fetchNextPage`, `isFetchingNextPage`), plus `pages` (the raw
`TPage[]`, for a call site that also needs per-page metadata — a running
`total` — alongside the flattened `data`).

One option beyond the plan's original sketch, added during Phase 3
implementation once a real call site needed it: `keepPreviousData` (same
opt-in as `createApiQuery`, needed on `admin/users`' list and
`LibraryBrowser`/`MediaSearchPanel` per the note above). No de-dupe option:
`MediaSearchPanel`'s external catalog search can return the same item across
consecutive pages, but that's specific to one source, not a general need —
it de-dupes `data` itself in a local `$derived`, rather than growing the
shared helper for a single call site.

## 4. Query keys and invalidation

```ts
// apps/web/src/lib/api/keys.ts
export const keys = {
  library: {
    all: () => ["library"] as const,
    list: (p: LibraryListParams) => ["library", "list", p] as const,
    entry: (id: string) => ["library", "entry", id] as const,
  },
  admin: {
    users: () => ["admin", "users"] as const,
    userSessions: (id: string) => ["admin", "user-sessions", id] as const,
  },
  // …one namespace per API domain
} as const;
```

Keys are hierarchical arrays so invalidating `["library"]` invalidates the
whole subtree. `invalidates` takes factory keys only: `["library"]` and
`keys.library.all()` say the same thing, and two syntaxes for one concept is
redundancy, not flexibility.

**Invalidation rule — invalidate only what is displayed at the same time as
the mutation.** Navigating away unmounts the query; coming back refetches on
mount whenever the data is stale, so cross-domain invalidation is mostly
redundant with `staleTime`. Do not write `invalidates` entries for screens
the user has navigated away from.

The exception is anything mounted in the layout, which never unmounts:
`app/+layout.svelte:19,56,69` mounts the `notifications` store (unread
badge), so marking a notification read from anywhere must invalidate it. In
practice `invalidates` carries one or two precise keys.

## 5. Phases

Each phase is one PR. Do not start a phase before the previous one is merged.

### Phase 0 — `requestId` → GlitchTip

Independent of everything else; ship it first.

`ApiError.requestId` (`lib/api/core.ts:26`) is parsed and then dropped.
`hooks.client.ts` only wires Sentry to `handleError`, i.e. _unhandled_
SvelteKit errors — so none of the caught API failures are visible in
monitoring today.

- Report from inside `request()` (`lib/api/core.ts`) — the single choke
  point, so non-helper callers are covered too.
- **5xx and network failures only** (`err.status >= 500 || err.status === 0`).
  401/403/404/409/429 are expected outcomes and would be noise.
- Attach `requestId` as a Sentry tag so a user-visible failure maps to a
  server log line.
- No UI surfacing of the id.
- Respect the existing convention: report only when the DSN is configured
  (`hooks.client.ts` already gates on `PUBLIC_GLITCHTIP_WEB_DSN`).

### Phase 1 — `keys.ts` + `createApiQuery` + pilot

- Create `apps/web/src/lib/api/keys.ts` with namespaces for the domains the
  pilot needs. Do not try to enumerate every domain up front; grow it per
  phase.
- Create `apps/web/src/lib/api/query.svelte.ts` (or similar) with
  `createApiQuery`.
- Set `staleTime: 30_000` in `apps/web/src/lib/queryClient.ts` alongside the
  existing `retry: 1`.
- **Pilot: one `/stats` section.** Pick `BookStatsSection.svelte` or
  `GameStatsSection.svelte` (simple reads, no pagination). The six sections
  using `statsResource()` are `Book`, `Game`, `Video`, `VideoTemporal`,
  `Music`, `Social`.
- The pilot must demonstrably fix two gaps `statsResource()` has today: it
  exposes **no `loading`**, and it has **no stale-response guard** (a
  re-fired `$effect` can land an older response last).
- Stop after one section and report before converting the rest.

### Phase 2 — `createApiMutation` + pilot

- Create the helper next to `createApiQuery`.
- **Pilot: one detail page** — `routes/app/media/[type]/[id]/+page.svelte`,
  `games/[id]`, `books/[id]` or `music/[id]`. All four go through
  `createLibraryEntryActions()` (`lib/library-entry.ts`), which covers
  add / patch / remove / replay, so one page validates every mutation shape.
- `lib/library-entry.ts` is **not** deleted in this phase — it is deleted in
  phase 4 once all four pages are converted.
- Stop after one page and report.

### Phase 3 — `createApiInfiniteQuery`

Specify it from what phases 1–2 revealed, then convert the six accumulating
call sites: `feed/+page.svelte`, `admin/users`, `admin/cache`,
`admin/security`, `LibraryBrowser.svelte`, `MediaSearchPanel.svelte`.
`ProfileActivity.svelte` and `RankBars.svelte` also match the pagination grep
— check them.

### Phase 4 — full migration

Convert every remaining call site, then delete
`lib/components/stats/stats-resource.svelte.ts` and `lib/library-entry.ts`.

Split this into several PRs by area (auth / settings / admin / library /
social) rather than one 80-file diff.

**Group A — the 27 files with no error handling at all** (real bugs; do
these first):

```
lib/admin-reports.svelte.ts
lib/components/AddToListModal.svelte
lib/components/HomeActivityPreview.svelte
lib/components/ProfileActivity.svelte
lib/components/ProfileReviews.svelte
lib/components/ReviewsSection.svelte
lib/components/TermsReacceptance.svelte
lib/components/UserSelector.svelte
lib/components/profile/ProfileView.svelte
lib/notifications.svelte.ts
routes/(auth)/forgot-password/+page.svelte
routes/(auth)/register/+page.svelte
routes/app/+page.svelte
routes/app/admin/+page.svelte
routes/app/admin/stats/components/AccountsSection.svelte
routes/app/admin/stats/components/SocialSection.svelte
routes/app/books/+page.svelte
routes/app/feed/+page.svelte
routes/app/games/+page.svelte
routes/app/lists/+page.svelte
routes/app/media/+page.svelte
routes/app/media/[type]/[id]/components/CastSection.svelte
routes/app/music/+page.svelte
routes/app/reviews/+page.svelte
routes/app/settings/components/PrivacySection.svelte
routes/app/settings/import/+page.svelte
```

(`CommentThread.svelte` also appears in that grep but is excluded — it
already uses TanStack directly and stays as-is.)

**Group B — the 53 files already calling `resolveApiError`.** Get the current
list with:

```sh
grep -rl "resolveApiError" --include=*.svelte --include=*.ts apps/web/src | grep -v spec
```

Excluding `lib/api/core.ts`, `lib/api/errors.ts` and
`lib/api/validation-messages.ts`, which are the implementation and must keep
their own uses.

## 6. Repo rules to respect

From `CLAUDE.md` — these are not optional:

- **Never run lint, format, typecheck or the test suite as a verification
  step.** `pre-commit` (lint-staged) and `pre-push` already do it, and CI
  runs the full suite on every PR. Run a specific test only when a change
  plausibly broke specific logic.
- Code, comments and commits in **English**. UI strings are **French-first
  but always via `m()`** (Paraglide) — never a hardcoded string. Sources in
  `apps/web/messages/{locale}/{common,errors,other}.json`.
- **No new runtime dependencies.** Everything here uses what is installed.
- **Check `apps/web/src/lib/components/` before writing a new component** —
  extend or reuse.
- The app is an installable **PWA**: check the mobile viewport on every UI
  change, not just desktop.
- Versioning is a lockstep bump across the four `package.json` files via the
  `version-bump` skill. Do not bump per phase — one bump when the whole
  effort lands, at Logan's call.
- Adding a `"Nouveau"` badge (`lib/feature-badges.ts`) does **not** apply
  here: this is an internal refactor with no user-visible feature.
- If anything in `packages/shared` changes, run `pnpm build:package` — it is
  consumed from its built `dist/`.

## 7. Traps

- **`error` is not `resolveApiError`.** Use `bannerMessage()`; see §3.
- **Do not migrate `CommentThread.svelte`.** It is the reference for direct
  TanStack usage (`createInfiniteQuery`, `createMutation`, `refetchInterval`
  polling) and deliberately stays below the helper layer.
- **`request()`'s refresh mutex must not be disturbed.** `lib/api/core.ts`
  holds a single-flight refresh so concurrent 401s don't each consume the
  rotating refresh token. TanStack will fire more parallel requests than the
  current code does, which exercises that path harder — read it before
  touching anything in `core.ts`.
- **`admin/users` is the densest file**: 8 independent mutations plus 7 reads
  fired on selection, each with its own `try/catch` swallowing to `[]`. Do
  not use it as a pilot; convert it once the helpers are proven.
- **Signed-in routes are SPA** (`ssr = false` in the `app`/`(auth)`/
  `(verification)` layouts). No SSR hydration of queries to worry about — but
  do not set `ssr = false` anywhere new, and never on the root layout.
- **`statsResource()`'s `$effect` reads reactive props synchronously** so it
  stays re-triggerable. Preserve that behaviour when replacing it: the
  section's `period` prop must still re-fire the query, which means the
  period belongs **in the key**.
- Do not add a lint rule forbidding raw `$lib/api/client` imports as part of
  this work. It was discussed and set aside: the helpers make the error path
  structural on their own, and a rule would fire on the helpers themselves.

## 8. Acceptance per phase

- **Phase 0** — a forced 500 reports to GlitchTip with a `requestId` tag; a
  403 does not.
- **Phase 1** — the migrated stats section shows a skeleton while loading, a
  translated banner on failure, and re-fetches when its `period` prop
  changes; the old `$state` trio is gone from it.
- **Phase 2** — the migrated detail page's add / patch / remove / replay all
  work, double-clicking a mutating button fires one request, and a failure
  shows a translated message.
- **Phase 3** — the six accumulating lists page correctly under both server
  paging styles.
- **Phase 4** — `stats-resource.svelte.ts` and `library-entry.ts` are
  deleted, and `grep -rn "resolveApiError" apps/web/src` returns only
  `lib/api/*.ts` and specs.

## 9. Out of scope

**Route duplication.** 215 route decorators on the API vs 210 `request()`
calls on the web, declared twice with nothing tying them. Query keys cannot
fix it: a route only yields a key's prefix (params carry the rest), and
invalidation is a semantic graph rather than a URL tree —
`library.service.ts:186` emits activity to the feed and
`stats.service.ts:542` reads `episodeWatch`, so one `POST /library/...`
touches three domains and no route encodes that. Tracked separately as
_"Generate the web API client from OpenAPI instead of declaring routes
twice"_ (`post_01m14vz9kpecw9tc4pg7v0ct29`).
