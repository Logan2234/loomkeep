<script lang="ts">
  import LoadMoreButton from "#lib/components/LoadMoreButton.svelte";

  import { type SelectOption } from "#lib/types/select-option.js";

  import AdminFilterBar from "../AdminFilterBar.svelte";
  import AdminQueryError from "../AdminQueryError.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { adminFilterHref, enumParam } from "#lib/url-params.js";
  import {
    ADMIN_USER_ADVANCED_KEYS,
    localDayBoundary,
    type AdminUserAdvancedFilters,
    type AdminUserAdvancedKey,
  } from "#lib/admin-user-filters.js";
  import { getAdminUsers } from "#lib/api/client.js";
  import { createApiInfiniteQuery } from "#lib/api/infinite-query.svelte.js";
  import { keys } from "#lib/api/keys.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Combobox from "#lib/components/Combobox.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import TabPanels from "#lib/components/TabPanels.svelte";
  import Tabs from "#lib/components/Tabs.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { debounce, SEARCH_DEBOUNCE_MS } from "#lib/debounce.js";
  import { formatDate, formatNumber, formatRelative } from "#lib/format.js";
  import { appConfig } from "#lib/config.svelte.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { Domain } from "@loomkeep/shared/enums";
  import {
    type AdminInvitationLinkDto,
    type AdminInvitationRedeemerDto,
    type AdminUserDto,
    type AdminUserFilter,
    type AdminUserSort,
    type PagedResult,
    ADMIN_USER_FILTERS,
    ADMIN_USER_SORTS,
  } from "@loomkeep/shared/contracts";
  import { onDestroy } from "svelte";
  import { flip } from "svelte/animate";
  import { fade, slide } from "svelte/transition";
  import InvitationsPanel from "./components/InvitationsPanel.svelte";
  import InviteUserModal from "./components/InviteUserModal.svelte";

  type Tab = "accounts" | "invitations";

  const reduced = prefersReducedMotion();
  const tab = $derived<Tab>(
    page.url.searchParams.get("tab") === "invitations"
      ? "invitations"
      : "accounts",
  );
  const TABS: SelectOption<Tab>[] = [
    { value: "accounts", label: m.admin_users_tab_accounts() },
    { value: "invitations", label: m.admin_users_tab_invitations() },
  ];
  // Null: closed. `initial` opens it on a link already minted (renewal).
  let inviteModal = $state<{ initial: AdminInvitationLinkDto | null } | null>(
    null,
  );
  let invitedFromModal = $state(false);

  function changeTab(value: Tab) {
    void goto(
      adminFilterHref(page.url, {
        tab: value === "accounts" ? null : value,
      }),
      { replace: true, reset: false },
    );
  }

  function openInvite(initial: AdminInvitationLinkDto | null = null) {
    invitedFromModal = false;
    inviteModal = { initial };
  }

  // Closing after minting one lands on the list it now sits in.
  function closeInvite() {
    inviteModal = null;
    if (invitedFromModal && tab !== "invitations") changeTab("invitations");
  }

  let query = $state(page.url.searchParams.get("q") ?? "");
  const queryFilter = $derived(page.url.searchParams.get("q") ?? "");
  const filter = $derived(
    enumParam(page.url.searchParams, "filter", ADMIN_USER_FILTERS, "all"),
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
    domain: page.url.searchParams.get("domain") ?? "",
  });
  const sort = $derived(
    enumParam(page.url.searchParams, "sort", ADMIN_USER_SORTS, "created"),
  );
  const dir = $derived<"asc" | "desc">(
    page.url.searchParams.get("dir") === "asc" ? "asc" : "desc",
  );
  let advancedOpen = $state(
    ADMIN_USER_ADVANCED_KEYS.some((key) => page.url.searchParams.has(key)),
  );

  const usersKey = $derived(
    keys.admin.users({ query: queryFilter, filter, ...advanced, sort, dir }),
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
        domain: advanced.domain,
        sort,
        dir,
      }),
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
    keepPreviousData: true,
  }));

  const users = $derived(usersQuery.data);
  const error = $derived(usersQuery.error);
  const filtering = $derived(
    usersQuery.fetching &&
      !usersQuery.loading &&
      !usersQuery.isFetchingNextPage,
  );
  const queryFilterDebounce = debounce(() => {
    void goto(adminFilterHref(page.url, { q: query.trim() || null }), {
      replace: true,
      reset: false,
    });
  }, SEARCH_DEBOUNCE_MS);
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
      { reset: false },
    );
  }

  function changeAdvanced(key: AdminUserAdvancedKey, value: string) {
    queryFilterDebounce.cancel();
    void goto(
      adminFilterHref(page.url, {
        q: query.trim() || null,
        [key]: value || null,
      }),
      { reset: false },
    );
  }

  function clearFilters() {
    queryFilterDebounce.cancel();
    const updates: Record<string, null> = { q: null, filter: null };
    for (const key of ADMIN_USER_ADVANCED_KEYS) updates[key] = null;
    void goto(adminFilterHref(page.url, updates), {
      reset: false,
    });
  }

  function openRedeemer(user: AdminInvitationRedeemerDto) {
    void goto(`/app/admin/users/${user.id}`);
  }

  // A second click on the sorted column flips its direction.
  function changeSort(key: AdminUserSort) {
    const nextDir = key === sort && dir === "desc" ? "asc" : "desc";
    void goto(
      adminFilterHref(page.url, {
        sort: key === "created" && nextDir === "desc" ? null : key,
        dir: nextDir === "asc" ? "asc" : null,
      }),
      { replace: true, reset: false },
    );
  }

  const activityLabel = (u: AdminUserDto): string =>
    u.online
      ? m.common_online()
      : u.lastActiveAt
        ? formatRelative(u.lastActiveAt)
        : m.admin_users_never_logged_in();

  const DOMAIN_KEYS = [
    { domain: Domain.MEDIA, count: "media" },
    { domain: Domain.GAMES, count: "games" },
    { domain: Domain.BOOKS, count: "books" },
    { domain: Domain.MUSIC, count: "music" },
  ] as const;
  const libraryTotal = (u: AdminUserDto) =>
    DOMAIN_KEYS.reduce((sum, d) => sum + u.libraryCounts[d.count], 0);

  const SECOND_FACTOR_LABELS = {
    TOTP: () => m.admin_users_factor_totp(),
    EMAIL: () => m.admin_users_factor_email(),
    WEBAUTHN: () => m.admin_users_factor_passkey(),
  };
  const SORTS: SelectOption<AdminUserSort>[] = $derived([
    { value: "created", label: m.admin_users_created() },
    { value: "active", label: m.common_active() },
    { value: "library", label: m.common_library() },
    ...(appConfig.gamificationEnabled
      ? [{ value: "xp" as const, label: m.admin_users_xp() }]
      : []),
  ]);

  const FILTERS: SelectOption<AdminUserFilter>[] = [
    { value: "all", label: m.common_all() },
    { value: "admin", label: m.common_admin() },
    { value: "unverified", label: m.admin_users_unverified() },
    { value: "never", label: m.admin_users_never_logged_in() },
    { value: "premium", label: m.admin_users_premium_filter() },
    { value: "deletion", label: m.admin_users_deletion_filter() },
    { value: "suspended", label: m.admin_users_suspended_filter() },
    { value: "onboarding", label: m.admin_users_onboarding_filter() },
    { value: "inactive", label: m.admin_users_inactive_filter() },
  ];
  const DOMAIN_OPTIONS = [
    { value: "", label: m.common_all() },
    ...DOMAIN_KEYS.map(({ domain }) => ({
      value: domain,
      label: DOMAINS[domain].label,
    })),
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
  const BINARY_OPTIONS = [
    { value: "", label: m.common_all() },
    { value: "yes", label: m.common_yes() },
    { value: "no", label: m.common_no() },
  ];
  const activeAdvanced = $derived(
    [
      ...DATE_FIELDS,
      ...BINARY_FIELDS,
      { key: "domain", label: m.admin_users_domain_filter() } as const,
    ]
      .filter(({ key }) => advanced[key])
      .map(({ key, label }) => ({
        key,
        label,
        value:
          advanced[key] === "yes"
            ? m.common_yes()
            : advanced[key] === "no"
              ? m.common_no()
              : key === "domain"
                ? (DOMAIN_OPTIONS.find((o) => o.value === advanced.domain)
                    ?.label ?? advanced.domain)
                : advanced[key],
      })),
  );
</script>

<div>
  <PageHeader
    icon="user"
    title={m.common_users()}
    back="/app/admin"
    class="mb-6">
    {#snippet actions()}
      <!-- The badge sits beside the button: inside it, it would be
           accent-on-accent and vanish. -->
      <button
        type="button"
        class="btn btn-primary"
        onclick={() => openInvite()}>
        <Icon name="plus" class="h-4 w-4" />
        {m.admin_invitations_invite()}
      </button>
    {/snippet}
  </PageHeader>

  <Tabs
    swipe={false}
    tabs={TABS}
    current={tab}
    onSelect={changeTab}
    label={m.admin_users_tabs_label()}
    idPrefix="admin-users"
    class="mb-5" />

  <TabPanels current={tab} idPrefix="admin-users">
    {#if tab === "invitations"}
      <InvitationsPanel
        onInvite={() => openInvite()}
        onRenewed={(link) => openInvite(link)}
        onOpenUser={openRedeemer} />
    {:else}
      <AdminFilterBar
        count={users.length}
        loading={usersQuery.loading || filtering}
        error={!!error}
        onReset={clearFilters}
        active={[
          ...(queryFilter
            ? [
                {
                  label: queryFilter,
                  remove: () => {
                    queryFilterDebounce.cancel();
                    void goto(adminFilterHref(page.url, { q: null }), {
                      reset: false,
                    });
                  },
                },
              ]
            : []),
          ...(filter !== "all"
            ? [
                {
                  label:
                    FILTERS.find((item) => item.value === filter)?.label ??
                    filter,
                  remove: () => changeFilter("all"),
                },
              ]
            : []),
          ...activeAdvanced.map((item) => ({
            label: `${item.label} : ${item.value}`,
            remove: () => changeAdvanced(item.key, ""),
          })),
        ]}>
        <div class="flex w-full flex-wrap items-center gap-2">
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
            onChange={(v) =>
              changeFilter((v[0] as AdminUserFilter) ?? "all")} />
          <div class="md:hidden">
            <Combobox
              label={m.common_sort()}
              options={SORTS}
              values={[sort]}
              onChange={(v) => {
                const key = (v[0] as AdminUserSort) ?? "created";
                if (key !== sort) changeSort(key);
              }} />
          </div>
        </div>

        <div class="border-border w-full rounded-lg border">
          <button
            type="button"
            class="text-fg flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold"
            aria-expanded={advancedOpen}
            aria-controls="admin-user-advanced-filters"
            onclick={() => (advancedOpen = !advancedOpen)}>
            <span class="flex flex-wrap items-center gap-2">
              {m.admin_users_advanced_filters()}
              {#if activeAdvanced.length > 0}
                <span class="text-dim">({activeAdvanced.length})</span>
              {/if}
            </span>
            <Icon
              name="chevron-right"
              class="h-4 w-4 shrink-0 transition-transform {advancedOpen
                ? 'rotate-90'
                : ''}" />
          </button>
          <div id="admin-user-advanced-filters">
            {#if advancedOpen}
              <div transition:slide={{ duration: reduced ? 0 : 180 }}>
                <div
                  class="border-border grid gap-4 border-t px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
                  {#each DATE_FIELDS as field (field.key)}
                    <label class="text-dim flex flex-col gap-1.5 text-sm">
                      {field.label}
                      <input
                        type="date"
                        value={advanced[field.key]}
                        onchange={(event) =>
                          changeAdvanced(field.key, event.currentTarget.value)}
                        class="border-border bg-surface text-fg rounded-lg border px-3 py-2" />
                    </label>
                  {/each}
                  <div
                    class="text-dim flex flex-col items-start gap-1.5 text-sm">
                    <span>{m.admin_users_domain_filter()}</span>
                    <Combobox
                      label={m.admin_users_domain_filter()}
                      options={DOMAIN_OPTIONS}
                      values={[advanced.domain]}
                      onChange={(values) =>
                        changeAdvanced("domain", values[0] ?? "")} />
                  </div>
                  {#each BINARY_FIELDS as field (field.key)}
                    <div
                      class="text-dim flex flex-col items-start gap-1.5 text-sm">
                      <span>{field.label}</span>
                      <Combobox
                        label={field.label}
                        options={BINARY_OPTIONS}
                        values={[advanced[field.key]]}
                        onChange={(values) =>
                          changeAdvanced(field.key, values[0] ?? "")} />
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>
      </AdminFilterBar>

      {#if filtering}
        <p
          role="status"
          transition:fade={{ duration: reduced ? 0 : 120 }}
          class="text-dim mb-2 text-sm">
          {m.common_loading()}
        </p>
      {/if}

      {#if error}
        <div transition:fade={{ duration: reduced ? 0 : 120 }}>
          <AdminQueryError message={error} queryKey={usersKey} />
        </div>
      {:else if usersQuery.loading}
        <div
          transition:fade={{ duration: reduced ? 0 : 120 }}
          class="card h-64 {reduced ? '' : 'animate-pulse'}">
        </div>
      {:else}
        <div
          transition:fade={{ duration: reduced ? 0 : 120 }}
          aria-busy={filtering}
          class="card overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr
                class="border-border text-dim border-b text-left text-xs font-semibold uppercase">
                <th class="px-4 py-2.5">
                  {m.common_account()}
                  {#if isFeatureNew("admin-user-page")}<NewBadge />{/if}
                </th>
                {#snippet sortHeader(key: AdminUserSort, label: string)}
                  <th
                    class="hidden p-0 md:table-cell"
                    aria-sort={sort === key
                      ? dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined}>
                    <button
                      type="button"
                      onclick={() => changeSort(key)}
                      class="hover:text-fg flex w-full items-center gap-1 px-4 py-2.5 text-left uppercase transition-colors {sort ===
                      key
                        ? 'text-accent'
                        : ''}">
                      {label}
                      <Icon
                        name="chevron-down"
                        class="h-3 w-3 transition-transform duration-150 {sort ===
                        key
                          ? dir === 'asc'
                            ? 'rotate-180'
                            : ''
                          : 'opacity-0'}" />
                    </button>
                  </th>
                {/snippet}
                {@render sortHeader("active", m.common_active())}
                {@render sortHeader("created", m.admin_users_created())}
                {@render sortHeader("library", m.common_library())}
                <th class="hidden px-4 py-2.5 lg:table-cell">
                  {m.common_domains()}
                </th>
                <th class="hidden px-4 py-2.5 lg:table-cell">
                  {m.common_security()}
                </th>
                {#if appConfig.gamificationEnabled}
                  {@render sortHeader("xp", m.admin_users_xp())}
                {/if}
              </tr>
            </thead>
            <tbody>
              {#each users as u (u.id)}
                {@const total = libraryTotal(u)}
                <tr
                  animate:flip={{ duration: reduced ? 0 : 160 }}
                  in:fade|global={{ duration: reduced ? 0 : 140 }}
                  out:fade|global={{ duration: reduced ? 0 : 100 }}
                  class="border-border hover:bg-surface-2/60 border-b transition-colors last:border-b-0">
                  <td class="px-4 py-3">
                    <a
                      href="/app/admin/users/{u.id}"
                      class="hover:bg-surface-2 -m-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg p-2 text-left transition-colors">
                      <span class="relative shrink-0">
                        <Avatar seed={u.username} url={u.avatarUrl} size={36} />
                        {#if u.online}
                          <span
                            class="bg-success border-surface absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2"
                            title={m.common_online()}></span>
                        {/if}
                      </span>
                      <div class="min-w-0">
                        <div
                          class="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span class="text-fg truncate font-semibold">
                            {u.displayName}
                          </span>
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
                          {#if u.suspendedUntil}
                            <span
                              class="border-danger/40 text-danger rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold whitespace-nowrap uppercase">
                              {m.admin_users_suspended_badge({
                                date: formatDate(u.suspendedUntil, {
                                  day: "2-digit",
                                  month: "2-digit",
                                }),
                              })}
                            </span>
                          {/if}
                          {#if u.deletionScheduledFor}
                            <span
                              class="border-danger/40 text-danger rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold whitespace-nowrap uppercase">
                              {m.admin_users_deletion_badge({
                                date: formatDate(u.deletionScheduledFor, {
                                  day: "2-digit",
                                  month: "2-digit",
                                }),
                              })}
                            </span>
                          {/if}
                          {#if !u.onboarded}
                            <span
                              class="border-warning/40 text-warning rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">
                              {m.admin_users_onboarding_badge()}
                            </span>
                          {/if}
                          {#if u.invitation}
                            <span
                              class="border-border text-dim rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold whitespace-nowrap uppercase">
                              {u.invitation.createdByName
                                ? m.admin_invitations_invited_by({
                                    name: u.invitation.createdByName,
                                  })
                                : m.admin_invitations_invited()}
                            </span>
                          {/if}
                        </div>
                        <p class="text-dim truncate text-xs">
                          @{u.username} · {u.email}
                        </p>

                        <!-- The other columns are dropped on a phone;
                         without this line their data was unreachable there. -->
                        <p
                          class="text-dim mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs md:hidden">
                          <span class={u.online ? "text-success" : ""}>
                            {activityLabel(u)}
                          </span>
                          <span aria-hidden="true">·</span>
                          {total === 1
                            ? m.common_item_count_one({ count: total })
                            : m.common_item_count_many({
                                count: formatNumber(total),
                              })}
                          {#if u.secondFactors.length}
                            <span
                              role="img"
                              aria-label={m.admin_users_second_factor()}
                              class="text-success">
                              <Icon name="lock" class="h-3 w-3" />
                            </span>
                          {/if}
                        </p>
                      </div>
                    </a>
                  </td>
                  <td class="hidden px-4 py-3 md:table-cell">
                    <div class="flex flex-col text-xs">
                      <span
                        class="font-semibold {u.online
                          ? 'text-success'
                          : 'text-fg'}">
                        {activityLabel(u)}
                      </span>
                      {#if u.lastActiveAt && !u.online}
                        <span class="text-dim timecode">
                          {formatDate(u.lastActiveAt, {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                          })}
                        </span>
                      {/if}
                    </div>
                  </td>
                  <td
                    class="text-dim timecode hidden px-4 py-3 text-xs md:table-cell">
                    {formatDate(u.createdAt, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </td>
                  <td class="hidden px-4 py-3 md:table-cell">
                    <span class="text-fg font-semibold tabular-nums">
                      {formatNumber(total)}
                    </span>
                    <span
                      class="bg-surface-2 mt-1 flex h-1.5 w-24 overflow-hidden rounded-full"
                      aria-hidden="true">
                      {#each DOMAIN_KEYS as d (d.domain)}
                        {#if u.libraryCounts[d.count]}
                          <span
                            style:flex-grow={u.libraryCounts[d.count]}
                            style:background={DOMAINS[d.domain].accent}></span>
                        {/if}
                      {/each}
                    </span>
                  </td>
                  <td class="hidden px-4 py-3 lg:table-cell">
                    <span class="flex gap-1">
                      {#each DOMAIN_KEYS as d (d.domain)}
                        {@const on = u.enabledDomains.includes(d.domain)}
                        {@const label = on
                          ? DOMAINS[d.domain].label
                          : m.admin_users_domain_off({
                              domain: DOMAINS[d.domain].label,
                            })}
                        <span
                          role="img"
                          aria-label={label}
                          title={label}
                          class="grid h-6 w-6 place-items-center rounded-md {on
                            ? ''
                            : 'border-border text-dim border border-dashed'}"
                          style:color={on
                            ? DOMAINS[d.domain].accent
                            : undefined}
                          style:background-color={on
                            ? `color-mix(in srgb, ${DOMAINS[d.domain].accent} 15%, transparent)`
                            : undefined}>
                          <Icon
                            name={DOMAINS[d.domain].icon}
                            class="h-3.5 w-3.5" />
                        </span>
                      {/each}
                    </span>
                  </td>
                  <td class="hidden px-4 py-3 text-xs lg:table-cell">
                    {#if u.secondFactors.length}
                      <span class="text-success flex items-center gap-1">
                        <Icon name="lock" class="h-3.5 w-3.5" />
                        {u.secondFactors
                          .map((f) => SECOND_FACTOR_LABELS[f]())
                          .join(", ")}
                      </span>
                    {:else}
                      <span class="text-dim">
                        {m.admin_users_password_only()}
                      </span>
                    {/if}
                  </td>
                  {#if appConfig.gamificationEnabled}
                    <td
                      class="text-fg hidden px-4 py-3 font-semibold tabular-nums md:table-cell">
                      {formatNumber(u.xp)}
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
          {#if users.length === 0}
            <p
              transition:fade={{ duration: reduced ? 0 : 120 }}
              class="text-dim px-4 py-6 text-center text-sm">
              {query.trim() || filter !== "all" || activeAdvanced.length > 0
                ? m.admin_users_empty_filter()
                : m.admin_users_empty()}
              <button
                class="btn btn-ghost mx-auto mt-3 block"
                onclick={queryFilter ||
                filter !== "all" ||
                activeAdvanced.length
                  ? clearFilters
                  : () => openInvite()}>
                {queryFilter || filter !== "all" || activeAdvanced.length
                  ? m.admin_filters_reset()
                  : m.admin_invitations_invite()}
              </button>
            </p>
          {/if}
        </div>

        {#if usersQuery.hasNextPage}
          <LoadMoreButton
            query={usersQuery}
            class="btn btn-ghost mt-4 w-full" />
        {/if}
      {/if}
    {/if}
  </TabPanels>
</div>

{#if inviteModal}
  <InviteUserModal
    initial={inviteModal.initial}
    onCreated={() => (invitedFromModal = true)}
    onclose={closeInvite} />
{/if}
