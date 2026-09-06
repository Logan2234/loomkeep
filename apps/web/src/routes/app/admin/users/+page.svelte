<script lang="ts">
  import { page } from "$app/state";
  import { getAdminUsers } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { keys } from "$lib/api/keys";
  import Avatar from "$lib/components/Avatar.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { debounce } from "$lib/debounce";
  import { formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    AdminUserDto,
    AdminUserFilter,
    PagedResult,
  } from "@loomkeep/shared";
  import UserDrawer from "./components/UserDrawer.svelte";

  // Pre-filled from `?q=` so links like /admin/users?q=<email> land pre-filtered
  // (used by the imports page's "Voir le compte →"). `query` is the raw
  // input; `queryFilter` is the debounced value that actually drives the
  // fetch (see onQueryInput below).
  let query = $state(page.url.searchParams.get("q") ?? "");
  let queryFilter = $state(page.url.searchParams.get("q") ?? "");
  let filter = $state<AdminUserFilter>("all");

  let selectedId = $state<string | null>(null);

  const usersKey = $derived(keys.admin.users({ query: queryFilter, filter }));

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
    queryFilter = query.trim();
  }, 300);
  function onQueryInput() {
    queryFilterDebounce.call();
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
  ];
</script>

<div class="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="user"
    title={m.common_users()}
    subtitle={m.admin_users_subtitle()} />

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
      onChange={(v) => (filter = (v[0] as AdminUserFilter) ?? "all")} />
  </div>

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
              onclick={() => (selectedId = u.id)}
              class="border-border hover:bg-surface-2 cursor-pointer border-b transition-colors last:border-b-0 {selected?.id ===
              u.id
                ? 'bg-accent/10'
                : ''}">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <Avatar seed={u.username} url={u.avatarUrl} size={36} />
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-fg truncate font-semibold"
                        >{u.displayName}</span>
                      {#if u.role === "ADMIN"}
                        <span
                          class="border-accent/40 bg-accent/10 text-accent rounded-full border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase">
                          {m.common_admin()}
                        </span>
                      {/if}
                      {#if u.plan === "PREMIUM"}
                        <span
                          class="border-warning/40 bg-warning/10 text-warning rounded-full border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase">
                          {m.common_premium()}
                        </span>
                      {/if}
                      {#if !u.emailVerified}
                        <span
                          class="border-border text-dim rounded-full border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase">
                          {m.admin_users_unverified()}
                        </span>
                      {/if}
                    </div>
                    <p class="text-dim truncate text-xs">{u.email}</p>
                  </div>
                </div>
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
          {query.trim() || filter !== "all"
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
