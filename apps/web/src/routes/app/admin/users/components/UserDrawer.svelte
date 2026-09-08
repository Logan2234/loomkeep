<script lang="ts">
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
    getAdminUserSessions,
    resendAdminUserVerification,
    revokeAdminUserSession,
    revokeAllAdminUserSessions,
    sendAdminUserPasswordReset,
    updateAdminUserPlan,
    updateAdminUserRole,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import AvatarLightbox from "$lib/components/AvatarLightbox.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { downloadBlob } from "$lib/download";
  import { formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import type { AdminUserDto, ModerationLegalBasis } from "@loomkeep/shared";
  import DeleteUserModal from "./DeleteUserModal.svelte";
  import UserActivityModal from "./UserActivityModal.svelte";

  type ActivityKind =
    "reviews" | "comments" | "followers" | "following" | "lists" | "reports";

  let {
    user,
    usersKey,
    onClose,
  }: {
    user: AdminUserDto;
    usersKey: ReturnType<typeof keys.admin.users>;
    onClose: () => void;
  } = $props();

  let showRevokeAllConfirm = $state(false);
  let showDeleteModal = $state(false);
  let activeModal = $state<ActivityKind | null>(null);
  let avatarLightbox = $state(false);

  const ACTIVITY_SECTIONS: { kind: ActivityKind; label: string }[] = [
    { kind: "reviews", label: m.admin_users_reviews() },
    { kind: "comments", label: m.common_comments() },
    { kind: "following", label: m.profile_connections_following_title() },
    { kind: "followers", label: m.profile_connections_followers_title() },
    { kind: "lists", label: m.common_lists() },
    { kind: "reports", label: m.admin_users_reports_received() },
  ];

  function activityCount(kind: ActivityKind): number {
    if (kind === "reviews") return reviews.length;
    if (kind === "comments") return comments.length;
    if (kind === "following") return following.length;
    if (kind === "followers") return followers.length;
    if (kind === "lists") return lists.length;
    return reportsAgainst.length;
  }

  const sessionsQuery = createApiQuery(() => ({
    key: keys.admin.userSessions(user.id),
    fetch: () => getAdminUserSessions(user.id),
  }));
  const sessions = $derived(sessionsQuery.data ?? []);

  const libraryStatsQuery = createApiQuery(() => ({
    key: keys.admin.userLibraryStats(user.id),
    fetch: () => getAdminUserLibraryStats(user.id),
  }));
  const libraryStats = $derived(libraryStatsQuery.data);

  const reviewsQuery = createApiQuery(() => ({
    key: keys.admin.userReviews(user.id),
    fetch: () => getAdminUserReviews(user.id),
  }));
  const commentsQuery = createApiQuery(() => ({
    key: keys.admin.userComments(user.id),
    fetch: () => getAdminUserComments(user.id),
  }));
  const followersQuery = createApiQuery(() => ({
    key: keys.admin.userFollowers(user.id),
    fetch: () => getAdminUserFollowers(user.id),
  }));
  const followingQuery = createApiQuery(() => ({
    key: keys.admin.userFollowing(user.id),
    fetch: () => getAdminUserFollowing(user.id),
  }));
  const listsQuery = createApiQuery(() => ({
    key: keys.admin.userLists(user.id),
    fetch: () => getAdminUserLists(user.id),
  }));
  const reportsAgainstQuery = createApiQuery(() => ({
    key: keys.admin.userReportsAgainst(user.id),
    fetch: () => getAdminUserReportsAgainst(user.id),
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

  const revokeMut = createApiMutation(() => ({
    mutate: (sessionId: string) => revokeAdminUserSession(user.id, sessionId),
    invalidates: [keys.admin.userSessions(user.id)],
  }));

  const revokeAllMut = createApiMutation(() => ({
    mutate: () => revokeAllAdminUserSessions(user.id),
    onSuccess: () => {
      showRevokeAllConfirm = false;
    },
    invalidates: [keys.admin.userSessions(user.id)],
  }));

  const roleMut = createApiMutation(() => ({
    mutate: (role: "ADMIN" | "USER") => updateAdminUserRole(user.id, role),
    invalidates: [usersKey],
  }));

  const planMut = createApiMutation(() => ({
    mutate: (plan: "FREE" | "PREMIUM") => updateAdminUserPlan(user.id, plan),
    invalidates: [usersKey],
  }));

  const exportMut = createApiMutation(() => ({
    mutate: () => getAdminUserExport(user.id),
    onSuccess: (data) => {
      downloadBlob(
        JSON.stringify(data, null, 2),
        "application/json",
        `loomkeep-export-${user.username}-${new Date().toISOString().slice(0, 10)}.json`,
      );
    },
  }));

  const verifyMut = createApiMutation(() => ({
    mutate: () => resendAdminUserVerification(user.id),
    successToast: m.admin_users_verification_resent(),
    errorToast: true,
  }));

  const resetMut = createApiMutation(() => ({
    mutate: () => sendAdminUserPasswordReset(user.id),
    successToast: m.admin_users_reset_link_sent(),
    errorToast: true,
  }));

  const deleteMut = createApiMutation(() => ({
    mutate: (args: {
      displayName: string;
      reasonText: string;
      legalBasis: ModerationLegalBasis;
      tosClause: string;
    }) =>
      deleteAdminUser(user.id, {
        reasonText: args.reasonText,
        legalBasis: args.legalBasis,
        tosClause: args.tosClause,
      }),
    onSuccess: (_data, args) => {
      showDeleteModal = false;
      onClose();
      toast.success(m.admin_users_deleted({ name: args.displayName }));
    },
    invalidates: [usersKey],
    coveredFields: ["reasonText", "legalBasis", "tosClause"],
  }));

  function openDeleteModal() {
    deleteMut.reset();
    showDeleteModal = true;
  }

  const DAY_MONTH_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && !showDeleteModal) onClose();
  }} />

<div class="fixed inset-0 z-50 flex justify-end">
  <button
    class="absolute inset-0 cursor-default bg-black/60"
    aria-label={m.common_close()}
    onclick={onClose}></button>
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
          <Avatar seed={user.username} url={user.avatarUrl} size={48} />
        </button>
        <div class="min-w-0">
          <h2 id="drawer-title" class="font-display truncate text-lg font-bold">
            {user.displayName}
          </h2>
          <p class="text-dim truncate text-xs">
            @{user.username} · {user.email}
          </p>
          <a
            href="/app/u/{user.username}"
            class="btn-text text-accent group mt-0.5">
            {m.admin_users_public_profile()}
            <Icon
              name="arrow-right"
              class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
      <button
        class="text-dim hover:bg-surface-2 hover:text-fg shrink-0 rounded-full p-1.5"
        aria-label={m.common_close()}
        onclick={onClose}>
        <Icon name="x" class="h-5 w-5" />
      </button>
    </div>

    {#if avatarLightbox}
      <AvatarLightbox
        seed={user.username}
        url={user.avatarUrl}
        onClose={() => (avatarLightbox = false)} />
    {/if}

    {#if user.inactivityWarningSentAt}
      <p
        class="border-warning/40 bg-warning/10 text-warning mb-4 rounded-lg border px-3 py-2 text-xs">
        {m.admin_users_inactivity_reminder()}
        {formatDate(user.inactivityWarningSentAt)}
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
          name="role"
          value="ADMIN"
          class="accent-accent h-4 w-4 shrink-0"
          checked={user.role === "ADMIN"}
          disabled={roleMut.loading ||
            (user.id === auth.user?.id && user.role === "ADMIN")}
          onchange={(e) =>
            roleMut.mutate(e.currentTarget.checked ? "ADMIN" : "USER")} />
      </label>
      {#if user.id === auth.user?.id && user.role === "ADMIN"}
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
      <div
        class="border-border flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
        <span class="text-fg font-semibold">{m.common_premium()}</span>
        <Combobox
          label={m.common_premium()}
          name="plan"
          options={[
            { label: m.admin_users_free(), value: "FREE" },
            { label: m.common_premium(), value: "PREMIUM" },
          ]}
          values={[user.plan]}
          disabled={planMut.loading}
          onChange={(v) => planMut.mutate(v[0] as "FREE" | "PREMIUM")} />
      </div>
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
                  {m.common_active()}
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
          {#each [{ label: m.media_movies(), value: libraryStats.movies }, { label: m.media_series_plural(), value: libraryStats.series }, { label: m.media_anime(), value: libraryStats.anime }, { label: m.common_Games(), value: libraryStats.games }, { label: m.common_Books(), value: libraryStats.books }, { label: m.common_albums(), value: libraryStats.music }] as stat (stat.label)}
            <div class="border-border rounded-lg border px-2 py-2 text-center">
              <p class="font-display text-base font-bold">{stat.value}</p>
              <p class="text-dim text-[0.65rem]">{stat.label}</p>
            </div>
          {/each}
        </div>
        <p class="text-dim mt-2 text-right text-xs">
          {libraryStats.total === 1
            ? m.common_item_count_one({ count: libraryStats.total })
            : m.common_item_count_many({ count: libraryStats.total })}
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
            user.email,
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

    <section class="border-danger/40 bg-danger/5 mt-auto rounded-xl border p-3">
      <h3
        class="text-danger mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-wider uppercase">
        {m.admin_users_sensitive_area()}
        <span class="bg-danger/40 h-px flex-1"></span>
      </h3>
      <div class="flex flex-col gap-2">
        <button
          onclick={() => verifyMut.mutate()}
          disabled={verifyMut.loading || user.emailVerified}
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
        {#if user.id === auth.user?.id}
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

{#if activeModal}
  <UserActivityModal
    kind={activeModal}
    {reviews}
    {comments}
    {followers}
    {following}
    {lists}
    {reportsAgainst}
    onClose={() => (activeModal = null)} />
{/if}

{#if showRevokeAllConfirm}
  <ConfirmationModal
    title={m.admin_users_revoke_all_title()}
    message={m.admin_users_revoke_all_message({ name: user.displayName })}
    confirmLabel={m.admin_users_revoke_all_confirm()}
    danger
    busy={revokeAllMut.loading}
    onConfirm={() => revokeAllMut.mutate()}
    onCancel={() => (showRevokeAllConfirm = false)} />
{/if}

{#if showDeleteModal}
  <DeleteUserModal
    username={user.username}
    displayName={user.displayName}
    busy={deleteMut.loading}
    error={deleteMut.error}
    fieldErrors={deleteMut.fieldErrors}
    onConfirm={({ reasonText, legalBasis, tosClause }) =>
      deleteMut.mutate({
        displayName: user.displayName,
        reasonText,
        legalBasis,
        tosClause,
      })}
    onCancel={() => (showDeleteModal = false)} />
{/if}
