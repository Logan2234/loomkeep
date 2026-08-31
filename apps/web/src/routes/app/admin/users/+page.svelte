<script lang="ts">
  import { page } from "$app/state";
  import {
    deleteAdminUser,
    getAdminUserComments,
    getAdminUserExport,
    getAdminUserFollowers,
    getAdminUserFollowing,
    getAdminUserLibraryStats,
    getAdminUserLists,
    getAdminUserReportsAgainst,
    getAdminUserReviews,
    getAdminUsers,
    getAdminUserSessions,
    resendAdminUserVerification,
    revokeAdminUserSession,
    revokeAllAdminUserSessions,
    sendAdminUserPasswordReset,
    updateAdminUserPlan,
    updateAdminUserRole,
  } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import AvatarLightbox from "$lib/components/AvatarLightbox.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import {
    MODERATION_LEGAL_BASIS_LABELS,
    REPORT_CATEGORY_LABELS,
    REPORT_MOTIF_LABELS,
    REPORT_STATUS_COLORS,
    REPORT_STATUS_LABELS,
  } from "$lib/constants/report-labels";
  import { formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import type {
    AdminUserDto,
    AdminUserFilter,
    ModerationLegalBasis,
    PagedResult,
  } from "@loomkeep/shared";

  // Pre-filled from `?q=` so links like /admin/users?q=<email> land pre-filtered
  // (used by the imports page's "Voir le compte →"). `query` is the raw
  // input; `queryFilter` is the debounced value that actually drives the
  // fetch (see onQueryInput below).
  let query = $state(page.url.searchParams.get("q") ?? "");
  let queryFilter = $state(page.url.searchParams.get("q") ?? "");
  let filter = $state<AdminUserFilter>("all");

  // --- drawer / detail state ---
  let selectedId = $state<string | null>(null);
  let showRevokeAllConfirm = $state(false);

  let showDeleteModal = $state(false);
  let deleteConfirmText = $state("");
  // DSA art. 17: sent as the statement of reasons in the deletion notice.
  let deleteReasonText = $state("");
  let deleteLegalBasis = $state<ModerationLegalBasis>("TOS_BREACH");
  let deleteTosClause = $state("");

  // --- social activity shortcuts ---
  type ActivityKind =
    "reviews" | "comments" | "followers" | "following" | "lists" | "reports";
  let activeModal = $state<ActivityKind | null>(null);
  let avatarLightbox = $state(false);

  const ACTIVITY_SECTIONS: { kind: ActivityKind; label: string }[] = [
    { kind: "reviews", label: m.admin_users_reviews() },
    { kind: "comments", label: m.admin_social_total_comments() },
    { kind: "following", label: m.profile_connections_following_title() },
    { kind: "followers", label: m.profile_connections_followers_title() },
    { kind: "lists", label: m.profile_lists_title() },
    { kind: "reports", label: m.admin_users_reports_received() },
  ];

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

  let searchTimeout: ReturnType<typeof setTimeout>;
  function onQueryInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      queryFilter = query.trim();
    }, 300);
  }

  function activityCount(kind: ActivityKind): number {
    if (kind === "reviews") return reviews.length;
    if (kind === "comments") return comments.length;
    if (kind === "following") return following.length;
    if (kind === "followers") return followers.length;
    if (kind === "lists") return lists.length;
    return reportsAgainst.length;
  }

  const sessionsQuery = createApiQuery(() => ({
    key: keys.admin.userSessions(selectedId ?? ""),
    fetch: () => getAdminUserSessions(selectedId!),
    enabled: !!selectedId,
  }));
  const sessions = $derived(sessionsQuery.data ?? []);

  const libraryStatsQuery = createApiQuery(() => ({
    key: keys.admin.userLibraryStats(selectedId ?? ""),
    fetch: () => getAdminUserLibraryStats(selectedId!),
    enabled: !!selectedId,
  }));
  const libraryStats = $derived(libraryStatsQuery.data);

  const reviewsQuery = createApiQuery(() => ({
    key: keys.admin.userReviews(selectedId ?? ""),
    fetch: () => getAdminUserReviews(selectedId!),
    enabled: !!selectedId,
  }));
  const commentsQuery = createApiQuery(() => ({
    key: keys.admin.userComments(selectedId ?? ""),
    fetch: () => getAdminUserComments(selectedId!),
    enabled: !!selectedId,
  }));
  const followersQuery = createApiQuery(() => ({
    key: keys.admin.userFollowers(selectedId ?? ""),
    fetch: () => getAdminUserFollowers(selectedId!),
    enabled: !!selectedId,
  }));
  const followingQuery = createApiQuery(() => ({
    key: keys.admin.userFollowing(selectedId ?? ""),
    fetch: () => getAdminUserFollowing(selectedId!),
    enabled: !!selectedId,
  }));
  const listsQuery = createApiQuery(() => ({
    key: keys.admin.userLists(selectedId ?? ""),
    fetch: () => getAdminUserLists(selectedId!),
    enabled: !!selectedId,
  }));
  const reportsAgainstQuery = createApiQuery(() => ({
    key: keys.admin.userReportsAgainst(selectedId ?? ""),
    fetch: () => getAdminUserReportsAgainst(selectedId!),
    enabled: !!selectedId,
  }));

  const reviews = $derived(reviewsQuery.data ?? []);
  const comments = $derived(commentsQuery.data ?? []);
  const followers = $derived(followersQuery.data ?? []);
  const following = $derived(followingQuery.data ?? []);
  const lists = $derived(listsQuery.data ?? []);
  const reportsAgainst = $derived(reportsAgainstQuery.data ?? []);
  const activityLoading = $derived(
    reviewsQuery.loading ||
      commentsQuery.loading ||
      followersQuery.loading ||
      followingQuery.loading ||
      listsQuery.loading ||
      reportsAgainstQuery.loading,
  );

  function closeDrawer() {
    selectedId = null;
    activeModal = null;
    avatarLightbox = false;
  }

  const revokeMut = createApiMutation(() => ({
    mutate: (sessionId: string) =>
      revokeAdminUserSession(selectedId!, sessionId),
    invalidates: [keys.admin.userSessions(selectedId ?? "")],
  }));

  const revokeAllMut = createApiMutation(() => ({
    mutate: () => revokeAllAdminUserSessions(selectedId!),
    onSuccess: () => {
      showRevokeAllConfirm = false;
    },
    invalidates: [keys.admin.userSessions(selectedId ?? "")],
  }));

  const roleMut = createApiMutation(() => ({
    mutate: (role: "ADMIN" | "USER") => updateAdminUserRole(selectedId!, role),
    invalidates: [usersKey],
  }));

  const planMut = createApiMutation(() => ({
    mutate: (plan: "FREE" | "PREMIUM") =>
      updateAdminUserPlan(selectedId!, plan),
    invalidates: [usersKey],
  }));

  const exportMut = createApiMutation(() => ({
    mutate: () => getAdminUserExport(selectedId!),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `loomkeep-export-${selected!.username}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  }));

  const verifyMut = createApiMutation(() => ({
    mutate: () => resendAdminUserVerification(selectedId!),
    successToast: m.admin_users_verification_resent(),
    errorToast: true,
  }));

  const resetMut = createApiMutation(() => ({
    mutate: () => sendAdminUserPasswordReset(selectedId!),
    successToast: m.admin_users_reset_link_sent(),
    errorToast: true,
  }));

  const deleteMut = createApiMutation(() => ({
    mutate: (_displayName: string) =>
      deleteAdminUser(selectedId!, {
        reasonText: deleteReasonText,
        legalBasis: deleteLegalBasis,
        tosClause: deleteTosClause,
      }),
    onSuccess: (_data, displayName) => {
      showDeleteModal = false;
      selectedId = null;
      toast.success(m.admin_users_deleted({ name: displayName }));
    },
    invalidates: [usersKey],
    coveredFields: ["reasonText", "legalBasis", "tosClause"],
  }));

  function openDeleteModal() {
    deleteConfirmText = "";
    deleteReasonText = "";
    deleteLegalBasis = "TOS_BREACH";
    deleteTosClause = "";
    deleteMut.reset();
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    if (deleteMut.loading) return;
    showDeleteModal = false;
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

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && selected && !showDeleteModal) closeDrawer();
  }} />

<div class="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="user"
    title={m.admin_users_title()}
    subtitle={m.admin_users_subtitle()} />

  <div class="mb-4 flex flex-wrap items-center gap-2">
    <input
      type="text"
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
              >{m.profile_activity_summary_prefix()}</th>
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
  <div class="fixed inset-0 z-50 flex justify-end">
    <button
      class="absolute inset-0 cursor-default bg-black/60"
      aria-label={m.common_close()}
      onclick={closeDrawer}></button>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      class="card relative z-10 flex h-full w-full max-w-sm flex-col overflow-y-auto rounded-none border-y-0 border-r-0 p-5">
      <div class="mb-4 flex items-start justify-between gap-2">
        <div class="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label={m.admin_users_enlarge_avatar()}
            onclick={() => (avatarLightbox = true)}
            class="cursor-zoom-in">
            <Avatar
              seed={selected.username}
              url={selected.avatarUrl}
              size={48} />
          </button>
          <div class="min-w-0">
            <h2
              id="drawer-title"
              class="font-display truncate text-lg font-bold">
              {selected.displayName}
            </h2>
            <p class="text-dim truncate text-xs">
              @{selected.username} · {selected.email}
            </p>
            <a
              href="/app/u/{selected.username}"
              class="btn-text text-accent mt-0.5">
              {m.admin_users_public_profile()}
            </a>
          </div>
        </div>
        <button
          class="text-dim hover:bg-surface-2 hover:text-fg shrink-0 rounded-full p-1.5"
          aria-label={m.common_close()}
          onclick={closeDrawer}>
          <Icon name="x" class="h-5 w-5" />
        </button>
      </div>

      {#if avatarLightbox}
        <AvatarLightbox
          seed={selected.username}
          url={selected.avatarUrl}
          onClose={() => (avatarLightbox = false)} />
      {/if}

      {#if selected.inactivityWarningSentAt}
        <p
          class="border-warning/40 bg-warning/10 text-warning mb-4 rounded-lg border px-3 py-2 text-xs">
          {m.admin_users_inactivity_reminder()}
          {formatDate(selected.inactivityWarningSentAt)}
          {m.admin_users_inactivity_deletion()}
        </p>
      {/if}

      <section class="mb-5">
        <h3
          class="text-dim mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
          {m.admin_users_identity()}
          <span class="bg-border h-px flex-1"></span>
        </h3>
        <label
          class="border-border flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
          for="role-admin">
          <span class="text-fg font-semibold"
            >{m.admin_users_administrator()}</span>
          <input
            id="role-admin"
            type="checkbox"
            class="accent-accent h-4 w-4 shrink-0"
            checked={selected.role === "ADMIN"}
            disabled={roleMut.loading ||
              (selected.id === auth.user?.id && selected.role === "ADMIN")}
            onchange={(e) =>
              roleMut.mutate(e.currentTarget.checked ? "ADMIN" : "USER")} />
        </label>
        {#if selected.id === auth.user?.id && selected.role === "ADMIN"}
          <p class="text-dim mt-1.5 text-xs">
            {m.admin_users_self_demote_hint()}
          </p>
        {/if}
        {#if roleMut.error}
          <p class="text-danger mt-1.5 text-xs">{roleMut.error}</p>
        {/if}
      </section>

      <section class="mb-5">
        <h3
          class="text-dim mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
          {m.admin_users_plan()}
          <span class="bg-border h-px flex-1"></span>
        </h3>
        <label
          class="border-border flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
          for="plan-select">
          <span class="text-fg font-semibold">{m.common_premium()}</span>
          <select
            id="plan-select"
            class="border-border bg-surface-2 text-fg rounded-md border px-2 py-1 text-sm"
            value={selected.plan}
            disabled={planMut.loading}
            onchange={(e) =>
              planMut.mutate(e.currentTarget.value as "FREE" | "PREMIUM")}>
            <option value="FREE">{m.admin_users_free()}</option>
            <option value="PREMIUM">{m.common_premium()}</option>
          </select>
        </label>
        <p class="text-dim mt-1.5 text-xs">
          {m.admin_users_manual_plan()}
        </p>
        {#if planMut.error}
          <p class="text-danger mt-1.5 text-xs">{planMut.error}</p>
        {/if}
      </section>

      <section class="mb-5">
        <h3
          class="text-dim mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
          {m.admin_users_access()}
          <span class="bg-border h-px flex-1"></span>
        </h3>
        {#if sessionsQuery.loading}
          <div class="space-y-2">
            {#each { length: 2 } as _, i (i)}
              <div class="skeleton h-12 rounded-lg"></div>
            {/each}
          </div>
        {:else if sessions.length > 0}
          <ul class="mb-2 space-y-2">
            {#each sessions as s (s.id)}
              <li
                class="border-border flex items-center gap-2 rounded-lg border px-3 py-2">
                <div class="min-w-0 flex-1">
                  <p class="text-fg truncate text-xs font-semibold">
                    {s.userAgent ?? m.settings_sessions_unknown_device()}
                  </p>
                  <p class="text-dim text-[0.65rem]">
                    {m.profile_activity_summary_prefix()}
                    {formatDate(s.lastUsedAt, DAY_MONTH_TIME_OPTIONS)}
                  </p>
                </div>
                <button
                  onclick={() => revokeMut.mutate(s.id)}
                  disabled={revokeMut.loading && revokeMut.variables === s.id}
                  aria-label={m.admin_users_revoke_session()}
                  class="text-dim hover:bg-danger/10 hover:text-danger shrink-0 rounded-lg p-1.5 transition-colors disabled:opacity-50">
                  <Icon name="trash" class="h-4 w-4" />
                </button>
              </li>
            {/each}
          </ul>
          {#if sessions.length > 1}
            <button
              class="btn btn-danger btn-sm w-full"
              onclick={() => (showRevokeAllConfirm = true)}>
              {m.admin_users_revoke_all()}
            </button>
          {/if}
        {:else}
          <p class="text-dim text-sm">{m.admin_users_no_sessions()}</p>
        {/if}
      </section>

      <section class="mb-5">
        <h3
          class="text-dim mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
          {m.admin_social_activity_title()}
          <span class="bg-border h-px flex-1"></span>
        </h3>
        {#if activityLoading}
          <div class="skeleton h-24 rounded-lg"></div>
        {:else}
          <ul
            class="border-border divide-border divide-y overflow-hidden rounded-lg border">
            {#each ACTIVITY_SECTIONS as s (s.kind)}
              <li>
                <button
                  type="button"
                  disabled={activityCount(s.kind) === 0}
                  onclick={() => (activeModal = s.kind)}
                  class="hover:bg-surface-2 flex w-full items-center justify-between px-3 py-2 text-left text-sm disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent">
                  <span class="text-fg">{s.label}</span>
                  <span class="text-dim text-xs font-semibold"
                    >{activityCount(s.kind)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="mb-5">
        <h3
          class="text-dim mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
          {m.common_library()}
          <span class="bg-border h-px flex-1"></span>
        </h3>
        {#if libraryStatsQuery.loading}
          <div class="skeleton h-28 rounded-lg"></div>
        {:else if libraryStats}
          <div class="grid grid-cols-3 gap-2">
            {#each [{ label: m.media_movies(), value: libraryStats.movies }, { label: m.media_series_plural(), value: libraryStats.series }, { label: m.media_anime(), value: libraryStats.anime }, { label: m.common_Games(), value: libraryStats.games }, { label: m.common_Books(), value: libraryStats.books }, { label: m.landing_salle_music_label(), value: libraryStats.music }] as stat (stat.label)}
              <div
                class="border-border rounded-lg border px-2 py-2 text-center">
                <p class="font-display text-base font-bold">{stat.value}</p>
                <p class="text-dim text-[0.65rem]">{stat.label}</p>
              </div>
            {/each}
          </div>
          <p class="text-dim mt-2 text-right text-xs">
            {libraryStats.total === 1
              ? m.admin_library_item_count_one({ count: libraryStats.total })
              : m.admin_library_item_count_many({ count: libraryStats.total })}
          </p>
        {:else}
          <p class="text-dim text-sm">{m.admin_users_stats_unavailable()}</p>
        {/if}
      </section>

      <section class="mb-5">
        <h3
          class="text-dim mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
          {m.admin_users_data()}
          <span class="bg-border h-px flex-1"></span>
        </h3>
        <div class="flex gap-2">
          <button
            onclick={() => exportMut.mutate()}
            disabled={exportMut.loading}
            class="btn btn-ghost btn-sm flex-1">
            <Icon name="download" class="mr-1 inline h-3.5 w-3.5" />
            {m.admin_users_export()}
          </button>
          <a
            href="/app/admin/communications?tab=push&email={encodeURIComponent(
              selected.email,
            )}"
            class="btn btn-ghost btn-sm flex-1 text-center">
            <Icon name="bell" class="mr-1 inline h-3.5 w-3.5" />
            {m.admin_users_push_test()}
          </a>
        </div>
        {#if exportMut.error}
          <p class="text-danger mt-1.5 text-xs">{exportMut.error}</p>
        {/if}
      </section>

      <section
        class="border-danger/40 bg-danger/5 mt-auto rounded-xl border p-3">
        <h3
          class="text-danger mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
          {m.admin_users_sensitive_area()}
          <span class="bg-danger/40 h-px flex-1"></span>
        </h3>
        <div class="flex flex-col gap-2">
          <button
            onclick={() => verifyMut.mutate()}
            disabled={verifyMut.loading || selected.emailVerified}
            class="btn btn-ghost btn-sm w-full">
            {verifyMut.loading
              ? m.common_sending()
              : m.settings_resend_verification_email()}
          </button>
          <button
            onclick={() => resetMut.mutate()}
            disabled={resetMut.loading}
            class="btn btn-ghost btn-sm w-full">
            {resetMut.loading ? m.common_sending() : m.admin_users_send_reset()}
          </button>
          {#if selected.id === auth.user?.id}
            <p class="text-dim text-xs">
              {m.admin_users_self_delete_hint()}
            </p>
          {:else}
            <button
              onclick={openDeleteModal}
              class="btn btn-danger btn-sm w-full">
              {m.settings_delete_account_modal_title()}
            </button>
          {/if}
        </div>
      </section>
    </div>
  </div>
{/if}

{#if activeModal === "reviews"}
  <Modal title={m.admin_users_reviews()} onclose={() => (activeModal = null)}>
    <ul class="space-y-2">
      {#each reviews as r (r.id)}
        <li class="border-border rounded-lg border p-3 text-sm">
          {#if r.target?.href}
            <a href={r.target.href} class="font-semibold hover:underline"
              >{r.target.title}</a>
          {:else}
            <span class="font-semibold"
              >{r.target?.title ?? m.admin_users_deleted_work()}</span>
          {/if}
          <span class="text-dim ml-2 text-xs">{r.rating}/10</span>
          {#if r.text}
            <p class="text-dim mt-1 line-clamp-2 text-xs">{r.text}</p>
          {/if}
        </li>
      {/each}
    </ul>
  </Modal>
{:else if activeModal === "comments"}
  <Modal
    title={m.admin_social_total_comments()}
    onclose={() => (activeModal = null)}>
    <ul class="space-y-2">
      {#each comments as c (c.id)}
        <li class="border-border rounded-lg border p-3 text-sm">
          {#if c.href}
            <a href={c.href} class="hover:underline">{c.excerpt}</a>
          {:else}
            <p>{c.excerpt}</p>
          {/if}
          <p class="text-dim mt-1 text-xs">
            {formatDate(c.createdAt)}
          </p>
        </li>
      {/each}
    </ul>
  </Modal>
{:else if activeModal === "followers" || activeModal === "following"}
  <Modal
    title={activeModal === "followers"
      ? m.profile_connections_followers_title()
      : m.profile_connections_following_title()}
    onclose={() => (activeModal = null)}>
    <ul class="space-y-1">
      {#each activeModal === "followers" ? followers : following as u (u.id)}
        <li>
          <a
            href="/app/u/{u.username}"
            class="hover:bg-surface-2 flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar seed={u.username} url={u.avatarUrl} size={36} />
            <span class="min-w-0">
              <span class="text-fg block truncate text-sm font-semibold"
                >{u.displayName}</span>
              <span class="text-dim block truncate text-xs">@{u.username}</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </Modal>
{:else if activeModal === "lists"}
  <Modal title={m.profile_lists_title()} onclose={() => (activeModal = null)}>
    <ul class="space-y-2">
      {#each lists as l (l.id)}
        <li class="border-border rounded-lg border p-3 text-sm">
          <div class="flex items-center gap-2">
            <span class="text-fg font-semibold">{l.title}</span>
            <span class="text-dim text-xs"
              >· {l.itemCount} {m.admin_items_suffix()}</span>
            {#if l.role === "EDITOR"}
              <span class="text-dim text-xs"
                >{m.admin_users_invited_by()} {l.author.displayName}</span>
            {/if}
          </div>
          <p class="text-dim mt-0.5 text-xs">
            {l.kind} · {l.visibility}
          </p>
        </li>
      {/each}
    </ul>
  </Modal>
{:else if activeModal === "reports"}
  <Modal
    title={m.admin_users_reports_received()}
    onclose={() => (activeModal = null)}>
    <ul class="space-y-2">
      {#each reportsAgainst as r (r.id)}
        <li class="border-border rounded-lg border p-3 text-sm">
          <div class="flex items-center gap-2">
            <span
              class="rounded-full border px-2 py-0.5 text-xs font-bold {REPORT_STATUS_COLORS[
                r.status
              ]}">{REPORT_STATUS_LABELS[r.status]}</span>
            <span class="text-dim ml-auto text-xs"
              >{formatDate(r.createdAt)}</span>
          </div>
          {#if r.target}
            {#if r.target.href}
              <a href={r.target.href} class="mt-1.5 block hover:underline"
                >{r.target.label}</a>
            {:else}
              <p class="mt-1.5">{r.target.label}</p>
            {/if}
          {/if}
          {#if r.category}
            <p class="text-dim mt-1 text-xs">
              {REPORT_CATEGORY_LABELS[r.category]}
              {#if r.motif}· {REPORT_MOTIF_LABELS[r.motif]}{/if}
            </p>
          {/if}
          {#if r.reason}
            <p class="text-dim mt-1 text-xs">« {r.reason} »</p>
          {/if}
        </li>
      {/each}
    </ul>
  </Modal>
{/if}

{#if showRevokeAllConfirm && selected}
  <ConfirmationModal
    title={m.admin_users_revoke_all_title()}
    message={m.admin_users_revoke_all_message({ name: selected.displayName })}
    confirmLabel={m.admin_users_revoke_all_confirm()}
    danger
    busy={revokeAllMut.loading}
    onConfirm={() => revokeAllMut.mutate()}
    onCancel={() => (showRevokeAllConfirm = false)} />
{/if}

{#if showDeleteModal && selected}
  <div class="fixed inset-0 z-60 flex items-end justify-center sm:items-center">
    <button
      class="absolute inset-0 cursor-default bg-black/60"
      aria-label={m.common_close()}
      onclick={closeDeleteModal}></button>
    <div
      role="dialog"
      aria-modal="true"
      class="card relative z-10 w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl">
      <h3 class="font-display text-danger mb-3 text-lg font-bold">
        {m.settings_delete_account_modal_title()}
      </h3>
      <p class="text-dim text-sm">
        {m.admin_users_delete_intro()}
        <strong class="text-fg">{selected.displayName}</strong>
        {m.admin_users_delete_warning()}
      </p>
      <p class="text-dim mt-3 text-sm">
        {m.admin_users_confirm_type()}
        <code
          class="bg-surface-2 text-fg rounded px-1.5 py-0.5 text-xs font-bold"
          >{selected.username}</code>
        {m.admin_confirmation_below()}
      </p>
      <input
        type="text"
        bind:value={deleteConfirmText}
        disabled={deleteMut.loading}
        placeholder={selected.username}
        class="border-border bg-surface mt-3 w-full rounded-lg border px-3 py-2 text-sm" />

      <p class="text-dim mt-4 text-xs">
        {m.admin_users_statement_description()}
      </p>
      <label class="mt-2 block text-sm font-semibold" for="delete-reason">
        {m.admin_moderation_facts()}
      </label>
      <textarea
        id="delete-reason"
        bind:value={deleteReasonText}
        disabled={deleteMut.loading}
        rows="3"
        class="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        placeholder={m.admin_users_reason_placeholder()}></textarea>
      <label class="mt-3 block text-sm font-semibold" for="delete-basis">
        {m.admin_moderation_basis()}
      </label>
      <select
        id="delete-basis"
        bind:value={deleteLegalBasis}
        disabled={deleteMut.loading}
        class="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 text-sm">
        {#each Object.entries(MODERATION_LEGAL_BASIS_LABELS) as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
      {#if deleteLegalBasis === "TOS_BREACH"}
        <label class="mt-3 block text-sm font-semibold" for="delete-clause">
          {m.admin_moderation_terms_clause()}
        </label>
        <input
          id="delete-clause"
          type="text"
          bind:value={deleteTosClause}
          disabled={deleteMut.loading}
          class="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          placeholder={m.admin_users_clause_placeholder()} />
      {/if}

      {#if deleteMut.error}
        <Banner variant="error" class="mt-3">{deleteMut.error}</Banner>
      {:else if deleteMut.fieldErrors.reasonText || deleteMut.fieldErrors.legalBasis || deleteMut.fieldErrors.tosClause}
        <Banner variant="error" class="mt-3">
          {deleteMut.fieldErrors.reasonText ??
            deleteMut.fieldErrors.legalBasis ??
            deleteMut.fieldErrors.tosClause}
        </Banner>
      {/if}
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          disabled={deleteMut.loading}
          onclick={closeDeleteModal}>
          {m.common_cancel()}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          disabled={deleteMut.loading ||
            deleteConfirmText !== selected.username ||
            !deleteReasonText.trim()}
          onclick={() => deleteMut.mutate(selected.displayName)}>
          {deleteMut.loading
            ? m.settings_delete_account_deleting()
            : m.settings_delete_account_confirm()}
        </button>
      </div>
    </div>
  </div>
{/if}
