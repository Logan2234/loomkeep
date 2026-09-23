<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { adminFilterHref } from "$lib/admin-filter-url";
  import {
    ADMIN_USER_ADVANCED_KEYS,
    localDayBoundary,
    type AdminUserAdvancedFilters,
    type AdminUserAdvancedKey,
  } from "$lib/admin-user-filters";
  import { getAdminUsers } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { keys } from "$lib/api/keys";
  import Avatar from "$lib/components/Avatar.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { debounce } from "$lib/debounce";
  import { formatDate } from "$lib/format";
  import { isFeatureNew } from "$lib/feature-badges";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    AdminUserDto,
    AdminUserFilter,
    PagedResult,
  } from "@loomkeep/shared";
  import { onDestroy } from "svelte";
  import { flip } from "svelte/animate";
  import { fade } from "svelte/transition";
  import UserDrawer from "./components/UserDrawer.svelte";

  const reduced = prefersReducedMotion();
  let query = $state(page.url.searchParams.get("q") ?? "");
  const queryFilter = $derived(page.url.searchParams.get("q") ?? "");
  const filter = $derived<AdminUserFilter>(
    ["admin", "unverified", "never", "premium"].includes(
      page.url.searchParams.get("filter") ?? "",
    )
      ? (page.url.searchParams.get("filter") as AdminUserFilter)
      : "all",
  );
  const advanced = $derived<AdminUserAdvancedFilters>({
    createdFrom: page.url.searchParams.get("createdFrom") ?? "",
    createdTo: page.url.searchParams.get("createdTo") ?? "",
    activeFrom: page.url.searchParams.get("activeFrom") ?? "",
    activeTo: page.url.searchParams.get("activeTo") ?? "",
    mfa: page.url.searchParams.get("mfa") ?? "",
    newsletter: page.url.searchParams.get("newsletter") ?? "",
    push: page.url.searchParams.get("push") ?? "",
    session: page.url.searchParams.get("session") ?? "",
  });

  let selectedId = $state<string | null>(null);

  const usersKey = $derived(
    keys.admin.users({ query: queryFilter, filter, ...advanced }),
  );

  const usersQuery = createApiInfiniteQuery<
    PagedResult<AdminUserDto>,
    number,
    AdminUserDto
  >(() => ({
    key: usersKey,
    fetch: (pageNum) =>
      getAdminUsers({
        search: queryFilter || undefined,
        filter,
        page: pageNum,
        createdFrom: localDayBoundary(advanced.createdFrom),
        createdTo: localDayBoundary(advanced.createdTo, true),
        activeFrom: localDayBoundary(advanced.activeFrom),
        activeTo: localDayBoundary(advanced.activeTo, true),
        mfa: advanced.mfa,
        newsletter: advanced.newsletter,
        push: advanced.push,
        session: advanced.session,
      }),
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
    keepPreviousData: true,
  }));

  const users = $derived(usersQuery.data);
  const error = $derived(usersQuery.error);
  // Looked up from the list rather than kept as its own copy, so a role/plan
  // change (which invalidates usersKey) refreshes the open drawer for free.
  const selected = $derived(users.find((u) => u.id === selectedId) ?? null);

  const queryFilterDebounce = debounce(() => {
    void goto(adminFilterHref(page.url, { q: query.trim() || null }), {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  }, 300);
  $effect(() => {
    queryFilterDebounce.cancel();
    query = page.url.searchParams.get("q") ?? "";
  });
  onDestroy(() => queryFilterDebounce.cancel());
  function onQueryInput() {
    queryFilterDebounce.call();
  }

  function changeFilter(value: AdminUserFilter) {
    queryFilterDebounce.cancel();
    void goto(
      adminFilterHref(page.url, {
        q: query.trim() || null,
        filter: value === "all" ? null : value,
      }),
      { noScroll: true, keepFocus: true },
    );
  }

  function changeAdvanced(key: AdminUserAdvancedKey, value: string) {
    queryFilterDebounce.cancel();
    void goto(
      adminFilterHref(page.url, {
        q: query.trim() || null,
        [key]: value || null,
      }),
      { noScroll: true, keepFocus: true },
    );
  }

  function clearFilters() {
    queryFilterDebounce.cancel();
    const updates: Record<string, null> = { q: null, filter: null };
    for (const key of ADMIN_USER_ADVANCED_KEYS) updates[key] = null;
    void goto(adminFilterHref(page.url, updates), {
      noScroll: true,
      keepFocus: true,
    });
  }

  function closeDrawer() {
    selectedId = null;
  }

  const DAY_MONTH_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };

  const activityLabel = (u: AdminUserDto): string =>
    u.lastActiveAt
      ? formatDate(u.lastActiveAt, DAY_MONTH_TIME_OPTIONS)
      : m.admin_users_never_logged_in();

  function activityDotClass(u: AdminUserDto): string {
    if (!u.lastActiveAt) return "border border-dim";
    const hoursAgo =
      (Date.now() - new Date(u.lastActiveAt).getTime()) / 3_600_000;
    return hoursAgo < 1 ? "bg-success" : "bg-dim";
  }

  const FILTERS: { value: AdminUserFilter; label: string }[] = [
    { value: "all", label: m.common_all() },
    { value: "admin", label: m.common_admin() },
    { value: "unverified", label: m.admin_users_unverified() },
    { value: "never", label: m.admin_users_never_logged_in() },
    { value: "premium", label: m.admin_users_premium_filter() },
  ];
  const DATE_FIELDS = [
    { key: "createdFrom", label: m.admin_users_created_from() },
    { key: "createdTo", label: m.admin_users_created_to() },
    { key: "activeFrom", label: m.admin_users_active_from() },
    { key: "activeTo", label: m.admin_users_active_to() },
  ] as const;
  const BINARY_FIELDS = [
    { key: "mfa", label: m.admin_users_mfa() },
    { key: "newsletter", label: m.admin_users_newsletter() },
    { key: "push", label: m.admin_users_push() },
    { key: "session", label: m.admin_users_session() },
  ] as const;
  const activeAdvanced = $derived(
    [...DATE_FIELDS, ...BINARY_FIELDS]
      .filter(({ key }) => advanced[key])
      .map(({ key, label }) => ({
        key,
        label,
        value:
          advanced[key] === "yes"
            ? m.common_yes()
            : advanced[key] === "no"
              ? m.common_no()
              : advanced[key],
      })),
  );
</script>

<div>
  <PageHeader
    icon="user"
    title={m.common_users()}
    subtitle={m.admin_users_subtitle()}
    back="/app/admin" />

  <div class="mb-4 flex flex-wrap items-center gap-2">
    <input
      type="text"
      name="query"
      aria-label={m.admin_users_search()}
      enterkeyhint="search"
      bind:value={query}
      oninput={onQueryInput}
      placeholder={m.admin_users_search()}
      class="border-border bg-surface w-full max-w-xs rounded-lg border px-3 py-2 text-sm" />
    <Combobox
      label={m.common_filter()}
      options={FILTERS}
      values={[filter]}
      onChange={(v) => changeFilter((v[0] as AdminUserFilter) ?? "all")} />
  </div>

  <details class="border-border mb-4 rounded-lg border px-4 py-3">
    <summary class="text-fg cursor-pointer text-sm font-semibold">
      {m.admin_users_advanced_filters()}
      {#if isFeatureNew("admin-user-filters")}
        <NewBadge />
      {/if}
      {#if activeAdvanced.length > 0}
        <span class="text-dim ml-1">({activeAdvanced.length})</span>
      {/if}
    </summary>
    <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {#each DATE_FIELDS as field (field.key)}
        <label class="text-dim flex flex-col gap-1 text-sm">
          {field.label}
          <input
            type="date"
            value={advanced[field.key]}
            onchange={(event) =>
              changeAdvanced(field.key, event.currentTarget.value)}
            class="border-border bg-surface text-fg rounded-lg border px-3 py-2" />
        </label>
      {/each}
      {#each BINARY_FIELDS as field (field.key)}
        <label class="text-dim flex flex-col gap-1 text-sm">
          {field.label}
          <select
            value={advanced[field.key]}
            onchange={(event) =>
              changeAdvanced(field.key, event.currentTarget.value)}
            class="border-border bg-surface text-fg rounded-lg border px-3 py-2">
            <option value="">{m.common_all()}</option>
            <option value="yes">{m.common_yes()}</option>
            <option value="no">{m.common_no()}</option>
          </select>
        </label>
      {/each}
    </div>
  </details>

  {#if activeAdvanced.length > 0 || filter !== "all" || queryFilter}
    <div class="mb-4 flex flex-wrap items-center gap-2">
      {#each activeAdvanced as item (item.key)}
        <button
          type="button"
          class="border-border text-dim hover:text-fg rounded-full border px-3 py-1 text-xs transition-colors"
          aria-label={m.admin_users_remove_filter({ filter: item.label })}
          onclick={() => changeAdvanced(item.key, "")}>
          {item.label} : {item.value} ×
        </button>
      {/each}
      <button type="button" class="btn btn-ghost" onclick={clearFilters}>
        {m.common_clear_filters()}
      </button>
    </div>
  {/if}

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if usersQuery.loading}
    <div class="card h-64 animate-pulse"></div>
  {:else}
    <div class="card overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr
            class="border-border text-dim border-b text-left text-xs font-semibold uppercase">
            <th class="px-4 py-2.5">{m.common_account()}</th>
            <th class="hidden px-4 py-2.5 sm:table-cell"
              >{m.common_active()}</th>
            <th class="hidden px-4 py-2.5 md:table-cell"
              >{m.admin_users_created()}</th>
          </tr>
        </thead>
        <tbody>
          {#each users as u (u.id)}
            <tr
              animate:flip={{ duration: reduced ? 0 : 160 }}
              in:fade|global={{ duration: reduced ? 0 : 140 }}
              out:fade|global={{ duration: reduced ? 0 : 100 }}
              class="border-border border-b transition-colors last:border-b-0 {selected?.id ===
              u.id
                ? 'bg-accent/10'
                : ''}">
              <td class="px-4 py-3">
                <button
                  type="button"
                  onclick={() => (selectedId = u.id)}
                  class="hover:bg-surface-2 -m-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg p-2 text-left transition-colors">
                  <Avatar seed={u.username} url={u.avatarUrl} size={36} />
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-fg truncate font-semibold"
                        >{u.displayName}</span>
                      {#if u.role === "ADMIN"}
                        <span
                          class="border-accent/40 bg-accent/10 text-accent rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">
                          {m.common_admin()}
                        </span>
                      {/if}
                      {#if u.plan === "PREMIUM"}
                        <span
                          class="border-warning/40 bg-warning/10 text-warning rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">
                          {m.common_premium()}
                        </span>
                      {/if}
                      {#if !u.emailVerified}
                        <span
                          class="border-border text-dim rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">
                          {m.admin_users_unverified()}
                        </span>
                      {/if}
                    </div>
                    <p class="text-dim truncate text-xs">{u.email}</p>

                    <!-- The "active" and "created" columns are dropped on a
                         phone; without this line their data was simply
                         unreachable there. -->
                    <p
                      class="text-dim mt-0.5 flex items-center gap-1.5 text-xs sm:hidden">
                      <span
                        class="h-1.5 w-1.5 shrink-0 rounded-full {activityDotClass(
                          u,
                        )}"></span>
                      {activityLabel(u)}
                      <span aria-hidden="true">·</span>
                      {formatDate(u.createdAt)}
                    </p>
                  </div>
                </button>
              </td>
              <td class="hidden px-4 py-3 sm:table-cell">
                <div class="text-dim flex items-center gap-2 text-xs">
                  <span
                    class="h-1.5 w-1.5 shrink-0 rounded-full {activityDotClass(
                      u,
                    )}"></span>
                  {activityLabel(u)}
                </div>
              </td>
              <td class="text-dim hidden px-4 py-3 text-xs md:table-cell">
                {formatDate(u.createdAt)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if users.length === 0}
        <p class="text-dim px-4 py-6 text-center text-sm">
          {query.trim() || filter !== "all" || activeAdvanced.length > 0
            ? m.admin_users_empty_filter()
            : m.admin_users_empty()}
        </p>
      {/if}
    </div>

    {#if usersQuery.hasNextPage}
      <button
        class="btn btn-ghost mt-4 w-full"
        disabled={usersQuery.isFetchingNextPage}
        onclick={() => usersQuery.fetchNextPage()}>
        {usersQuery.isFetchingNextPage
          ? m.common_loading()
          : m.common_load_more()}
      </button>
    {/if}
  {/if}
</div>

{#if selected}
  <UserDrawer user={selected} {usersKey} onClose={closeDrawer} />
{/if}
