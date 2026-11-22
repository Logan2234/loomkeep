<script lang="ts">
  import { typedEntries } from "#lib/object.js";

  import { type ActivityKind } from "./activity-kind";

  import {
    adjustAdminUserXp,
    cancelAdminUserDeletion,
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
    reactivateAdminUser,
    resendAdminUserVerification,
    revokeAdminUserSession,
    revokeAllAdminUserSessions,
    sendAdminUserPasswordReset,
    updateAdminUserPlan,
    updateAdminUserRole,
  } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import { appConfig } from "#lib/config.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import AvatarLightbox from "#lib/components/AvatarLightbox.svelte";
  import Banner from "#lib/components/Banner.svelte";
  import Combobox from "#lib/components/Combobox.svelte";
  import ConfirmationModal from "#lib/components/ConfirmationModal.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { DELETION_REASON_LABELS } from "#lib/constants/deletion-reasons.js";
  import { ACQUISITION_SOURCE_LABELS } from "#lib/constants/acquisition-sources.js";
  import { DOMAIN_IDS, DOMAINS } from "#lib/constants/domains.js";
  import { securityEventLabels } from "#lib/constants/security-events.js";
  import { getLocale } from "#lib/paraglide/runtime.js";
  import { goto } from "$app/navigation";
  import { downloadBlob, datedFilename } from "#lib/download.js";
  import {
    formatDate,
    formatDateTime,
    formatNumber,
    formatRegion,
    formatRelative,
  } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/toast.svelte.js";
  import {
    IMPORT_SOURCE_NAMES,
    levelForXp,
    type AdminUserDetailDto,
    type AdminUserLibraryKind,
    type ImportSource,
    type ModerationLegalBasis,
  } from "@loomkeep/shared";
  import {
    CADENCE_LABELS,
    MEASURE_LABELS,
    PROFILE_ACCESS_LABELS,
    PUSH_PLATFORM_LABELS,
    REVIEW_VISIBILITY_LABELS,
  } from "../account-labels";
  import { useQueryClient } from "@tanstack/svelte-query";
  import DeleteUserModal from "./DeleteUserModal.svelte";
  import UserLibraryModal from "./UserLibraryModal.svelte";
  import UserActivityModal from "./UserActivityModal.svelte";

  let { detail }: { detail: AdminUserDetailDto } = $props();
  const user = $derived(detail.user);
  const journey = $derived(detail.journey);
  const security = $derived(detail.security);
  const preferences = $derived(detail.preferences);
  const moderation = $derived(detail.moderation);
  // Role, plan, XP and status show here and in the accounts list alike.
  const accountKeys = $derived([
    keys.admin.user(user.id),
    keys.admin.allUsers(),
  ]);

  const libraryTotal = $derived(
    Object.values(user.libraryCounts).reduce((sum, n) => sum + n, 0),
  );
  const failedImports = $derived(
    detail.imports.filter((run) => run.status === "FAILURE").length,
  );
  const SECURITY_EVENT_LABELS = securityEventLabels();

  function languageName(locale: string): string {
    try {
      return (
        new Intl.DisplayNames([getLocale()], { type: "language" }).of(locale) ??
        locale
      );
    } catch {
      return locale;
    }
  }

  const SECTIONS = $derived([
    { id: "account", label: m.common_account() },
    { id: "library", label: m.common_library() },
    { id: "security", label: m.common_security() },
    { id: "preferences", label: m.admin_user_section_preferences() },
    { id: "social", label: m.common_social() },
    { id: "moderation", label: m.admin_user_section_moderation() },
    { id: "sensitive", label: m.admin_users_sensitive_area() },
  ]);
  let activeSection = $state("account");

  // Highlights the section being read in the side menu.
  function observeSection(node: HTMLElement) {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) activeSection = node.id;
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }

  let showRevokeAllConfirm = $state(false);
  let showCancelDeletionConfirm = $state(false);
  let showDeleteModal = $state(false);
  let activeModal = $state<ActivityKind | null>(null);
  let libraryModal = $state<{
    kind: AdminUserLibraryKind;
    label: string;
  } | null>(null);
  let avatarLightbox = $state(false);
  const queryClient = useQueryClient();

  const ACTIVITY = {
    reviews: {
      label: m.admin_users_reviews(),
      query: () => reviewsQuery,
      count: () => reviews.length,
      key: keys.admin.userReviews,
    },
    comments: {
      label: m.common_comments(),
      query: () => commentsQuery,
      count: () => comments.length,
      key: keys.admin.userComments,
    },
    following: {
      label: m.profile_connections_following_title(),
      query: () => followingQuery,
      count: () => following.length,
      key: keys.admin.userFollowing,
    },
    followers: {
      label: m.profile_connections_followers_title(),
      query: () => followersQuery,
      count: () => followers.length,
      key: keys.admin.userFollowers,
    },
    lists: {
      label: m.common_lists(),
      query: () => listsQuery,
      count: () => lists.length,
      key: keys.admin.userLists,
    },
    reports: {
      label: m.admin_users_reports_received(),
      query: () => reportsAgainstQuery,
      count: () => reportsAgainst.length,
      key: keys.admin.userReportsAgainst,
    },
  } satisfies Record<
    ActivityKind,
    {
      label: string;
      query: () => { data: unknown; error: string | null; loading: boolean };
      count: () => number;
      key: (id: string) => readonly unknown[];
    }
  >;
  const ACTIVITY_SECTIONS = typedEntries(ACTIVITY).map(
    ([kind, definition]) => ({ kind, label: definition.label }),
  );
  function activityCount(kind: ActivityKind) {
    return ACTIVITY[kind].count();
  }
  function activityError(kind: ActivityKind) {
    return ACTIVITY[kind].query().error;
  }
  function activityLoading(kind: ActivityKind) {
    return ACTIVITY[kind].query().loading;
  }
  function activityHasData(kind: ActivityKind) {
    return ACTIVITY[kind].query().data !== null;
  }
  function retryActivity(kind: ActivityKind) {
    void queryClient.refetchQueries({ queryKey: ACTIVITY[kind].key(user.id) });
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
  const libraryTiles = $derived(
    libraryStats
      ? ([
          {
            kind: "movies",
            label: m.media_movies(),
            value: libraryStats.movies,
          },
          {
            kind: "series",
            label: m.media_series_plural(),
            value: libraryStats.series,
          },
          { kind: "anime", label: m.media_anime(), value: libraryStats.anime },
          { kind: "games", label: m.common_Games(), value: libraryStats.games },
          { kind: "books", label: m.common_Books(), value: libraryStats.books },
          {
            kind: "music",
            label: m.common_albums(),
            value: libraryStats.music,
          },
        ] satisfies {
          kind: AdminUserLibraryKind;
          label: string;
          value: number;
        }[])
      : [],
  );

  const reviewsQuery = createApiQuery(() => ({
    key: keys.admin.userReviews(user.id),
    fetch: () => getAdminUserReviews(user.id),
    enabled: activeModal === "reviews",
  }));
  const commentsQuery = createApiQuery(() => ({
    key: keys.admin.userComments(user.id),
    fetch: () => getAdminUserComments(user.id),
    enabled: activeModal === "comments",
  }));
  const followersQuery = createApiQuery(() => ({
    key: keys.admin.userFollowers(user.id),
    fetch: () => getAdminUserFollowers(user.id),
    enabled: activeModal === "followers",
  }));
  const followingQuery = createApiQuery(() => ({
    key: keys.admin.userFollowing(user.id),
    fetch: () => getAdminUserFollowing(user.id),
    enabled: activeModal === "following",
  }));
  const listsQuery = createApiQuery(() => ({
    key: keys.admin.userLists(user.id),
    fetch: () => getAdminUserLists(user.id),
    enabled: activeModal === "lists",
  }));
  const reportsAgainstQuery = createApiQuery(() => ({
    key: keys.admin.userReportsAgainst(user.id),
    fetch: () => getAdminUserReportsAgainst(user.id),
    enabled: activeModal === "reports",
  }));

  const reviews = $derived(reviewsQuery.data ?? []);
  const comments = $derived(commentsQuery.data ?? []);
  const followers = $derived(followersQuery.data ?? []);
  const following = $derived(followingQuery.data ?? []);
  const lists = $derived(listsQuery.data ?? []);
  const reportsAgainst = $derived(reportsAgainstQuery.data ?? []);
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
    invalidates: accountKeys,
  }));

  const planMut = createApiMutation(() => ({
    mutate: (plan: "FREE" | "PREMIUM") => updateAdminUserPlan(user.id, plan),
    invalidates: accountKeys,
  }));

  let xpAmount = $state<number | null>(null);

  const xpMut = createApiMutation(() => ({
    mutate: (amount: number) => adjustAdminUserXp(user.id, amount),
    invalidates: accountKeys,
    onSuccess: (result) => {
      xpAmount = null;
      toast.success(m.admin_users_xp_done({ xp: formatNumber(result.xp) }));
    },
  }));

  function adjustXp() {
    if (!xpAmount || !Number.isInteger(xpAmount)) return;
    xpMut.mutate(xpAmount);
  }

  const exportMut = createApiMutation(() => ({
    mutate: () => getAdminUserExport(user.id),
    onSuccess: (data) => {
      downloadBlob(
        JSON.stringify(data, null, 2),
        "application/json",
        datedFilename(`loomkeep-export-${user.username}`, "json"),
      );
    },
  }));

  const verifyMut = createApiMutation(() => ({
    mutate: () => resendAdminUserVerification(user.id),
    successToast: m.admin_users_verification_resent(),
    errorToast: true,
  }));

  const reactivateMut = createApiMutation(() => ({
    mutate: () => reactivateAdminUser(user.id),
    invalidates: accountKeys,
    errorToast: true,
  }));

  const cancelDeletionMut = createApiMutation(() => ({
    mutate: () => cancelAdminUserDeletion(user.id),
    invalidates: accountKeys,
    successToast: m.admin_users_deletion_cancelled(),
    errorToast: true,
    onSuccess: () => (showCancelDeletionConfirm = false),
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
      toast.success(m.admin_users_deleted({ name: args.displayName }));
      void goto("/app/admin/users");
    },
    invalidates: [keys.admin.allUsers()],
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

{#snippet sectionTitle(text: string)}
  <h2 class="font-display mb-3 flex items-center gap-3 text-lg font-bold">
    {text}
    <span class="bg-border h-px flex-1"></span>
  </h2>
{/snippet}

{#snippet panelTitle(text: string)}
  <h3
    class="text-dim text-micro border-border border-b px-4 py-2.5 font-bold tracking-wider uppercase">
    {text}
  </h3>
{/snippet}

{#snippet row(label: string, value: string, tone: string = "text-fg")}
  <div class="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
    <dt class="text-dim">{label}</dt>
    <dd class="min-w-0 text-right font-semibold break-words {tone}">{value}</dd>
  </div>
{/snippet}

<div class="pb-10">
  <a
    href="/app/admin/users"
    class="text-dim hover:text-fg mb-3 inline-flex items-center gap-1 text-sm transition-colors">
    <Icon name="chevron-left" class="h-4 w-4" />
    {m.common_users()}
  </a>

  <header class="border-border flex flex-wrap items-start gap-4 border-b pb-5">
    <button
      type="button"
      aria-label={m.admin_users_enlarge_avatar()}
      onclick={() => (avatarLightbox = true)}
      class="relative shrink-0 cursor-zoom-in">
      <Avatar seed={user.username} url={user.avatarUrl} size={64} />
      {#if user.online}
        <span
          class="bg-success border-bg absolute right-0 bottom-0 h-4 w-4 rounded-full border-2"
          title={m.common_online()}></span>
      {/if}
    </button>
    <div class="min-w-0 flex-1">
      <h1 class="font-display text-2xl font-extrabold text-balance">
        {user.displayName}
      </h1>
      <p class="text-dim text-sm break-words">
        @{user.username} · {user.email}
        ·
        <a href="/app/u/{user.username}" class="link-accent"
          >{m.admin_users_public_profile()}</a>
      </p>
      <div class="mt-2 flex flex-wrap gap-1.5">
        {#if user.role === "ADMIN"}
          <span
            class="border-accent/40 bg-accent/10 text-accent rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase"
            >{m.common_admin()}</span>
        {/if}
        {#if user.plan === "PREMIUM"}
          <span
            class="border-warning/40 bg-warning/10 text-warning rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase"
            >{m.common_premium()}</span>
        {/if}
        {#if !user.emailVerified}
          <span
            class="border-border text-dim rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase"
            >{m.admin_users_unverified()}</span>
        {/if}
        {#if user.secondFactors.length}
          <span
            class="border-success/40 text-success rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase"
            >{m.admin_users_second_factor()}</span>
        {/if}
        {#if !user.onboarded}
          <span
            class="border-warning/40 text-warning rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase"
            >{m.admin_users_onboarding_badge()}</span>
        {/if}
      </div>
    </div>
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        onclick={() => exportMut.mutate()}
        disabled={exportMut.loading}
        class="btn btn-ghost btn-sm">
        <Icon name="download" class="h-3.5 w-3.5" />
        {m.admin_users_export()}
      </button>
      <a
        href="/app/admin/communications?tab=push&email={encodeURIComponent(
          user.email,
        )}"
        class="btn btn-ghost btn-sm">
        <Icon name="bell" class="h-3.5 w-3.5" />
        {m.admin_users_push_test()}
      </a>
    </div>
  </header>
  {#if exportMut.error}
    <p class="text-danger mt-2 text-xs">{exportMut.error}</p>
  {/if}

  {#if avatarLightbox}
    <AvatarLightbox
      seed={user.username}
      url={user.avatarUrl}
      onClose={() => (avatarLightbox = false)} />
  {/if}

  <dl class="my-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
    <div class="card px-3 py-2.5">
      <dt class="text-dim text-xs">{m.admin_user_last_active()}</dt>
      <dd
        class="font-display text-lg font-bold {user.online
          ? 'text-success'
          : ''}">
        {user.online
          ? m.common_online()
          : user.lastActiveAt
            ? formatRelative(user.lastActiveAt)
            : m.admin_users_never_logged_in()}
      </dd>
    </div>
    <div class="card px-3 py-2.5">
      <dt class="text-dim text-xs">{m.admin_user_joined()}</dt>
      <dd class="font-display text-lg font-bold">
        {formatDate(user.createdAt)}
      </dd>
    </div>
    <div class="card px-3 py-2.5">
      <dt class="text-dim text-xs">{m.common_library()}</dt>
      <dd class="font-display text-lg font-bold">
        {libraryTotal === 1
          ? m.common_item_count_one({ count: libraryTotal })
          : m.common_item_count_many({ count: formatNumber(libraryTotal) })}
      </dd>
    </div>
    <div class="card px-3 py-2.5">
      <dt class="text-dim text-xs">{m.admin_user_imports()}</dt>
      <dd class="font-display text-lg font-bold">
        {detail.imports.length}
        {#if failedImports}
          <span class="text-danger text-xs font-semibold"
            >{m.admin_user_imports_failed({ count: failedImports })}</span>
        {/if}
      </dd>
    </div>
    {#if appConfig.gamificationEnabled}
      <div class="card px-3 py-2.5">
        <dt class="text-dim text-xs">{m.admin_users_xp()}</dt>
        <dd class="font-display timecode text-lg font-bold">
          {formatNumber(user.xp)}
        </dd>
      </div>
    {/if}
  </dl>

  <div class="grid items-start gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
    <nav
      aria-label={m.admin_user_sections()}
      class="bg-bg border-border sticky top-[env(safe-area-inset-top,0px)] z-10 -mx-4 flex gap-1 overflow-x-auto border-b px-4 py-2 lg:top-4 lg:mx-0 lg:flex-col lg:border-0 lg:p-0">
      {#each SECTIONS as s (s.id)}
        <a
          href="#{s.id}"
          aria-current={activeSection === s.id ? "true" : undefined}
          class="text-dim hover:bg-surface-2 hover:text-fg aria-[current=true]:bg-accent/10 aria-[current=true]:text-accent rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors"
          >{s.label}</a>
      {/each}
    </nav>

    <div class="flex min-w-0 flex-col gap-8">
      <section id="account" class="scroll-mt-20" use:observeSection>
        {@render sectionTitle(m.common_account())}

        {#if user.suspendedUntil}
          <div
            class="border-danger/40 bg-danger/10 text-danger mb-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
            <span>
              {m.admin_users_suspended_until({
                date: formatDateTime(user.suspendedUntil),
              })}
            </span>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              disabled={reactivateMut.loading}
              onclick={() => reactivateMut.mutate()}>
              {m.admin_users_reactivate()}
            </button>
          </div>
        {/if}

        {#if user.deletionScheduledFor}
          <div
            class="border-danger/40 bg-danger/10 text-danger mb-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
            <span>
              {m.admin_users_deletion_scheduled({
                date: formatDate(user.deletionScheduledFor),
              })}
              <span class="mt-0.5 block text-xs">
                {user.deletionReason
                  ? m.admin_users_deletion_reason({
                      reason: DELETION_REASON_LABELS[user.deletionReason](),
                    })
                  : m.admin_users_deletion_reason_none()}
              </span>
            </span>
            <button
              type="button"
              class="btn btn-ghost btn-sm shrink-0"
              disabled={cancelDeletionMut.loading}
              onclick={() => (showCancelDeletionConfirm = true)}>
              {m.settings_delete_account_cancel()}
            </button>
          </div>
        {/if}

        {#if user.inactivityWarningSentAt}
          <p
            class="border-warning/40 bg-warning/10 text-warning mb-3 rounded-lg border px-3 py-2 text-sm">
            {m.admin_users_inactivity_reminder()}
            {formatDate(user.inactivityWarningSentAt)}
            {m.admin_users_inactivity_deletion()}
          </p>
        {/if}

        <div class="grid gap-3 md:grid-cols-2">
          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_users_identity())}
            <div class="divide-border divide-y">
              <label
                class="flex items-center justify-between gap-2 px-4 py-3 text-sm"
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
                    roleMut.mutate(
                      e.currentTarget.checked ? "ADMIN" : "USER",
                    )} />
              </label>
              {#if user.id === auth.user?.id && user.role === "ADMIN"}
                <p class="text-dim px-4 py-2 text-xs">
                  {m.admin_users_self_demote_hint()}
                </p>
              {/if}
              {#if roleMut.error}
                <p class="text-danger px-4 py-2 text-xs">{roleMut.error}</p>
              {/if}
              <div class="px-4 py-3 text-sm">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-fg font-semibold"
                    >{m.admin_users_plan()}</span>
                  <Combobox
                    label={m.admin_users_plan()}
                    name="plan"
                    options={[
                      { label: m.admin_users_free(), value: "FREE" },
                      { label: m.common_premium(), value: "PREMIUM" },
                    ]}
                    values={[user.plan]}
                    disabled={planMut.loading}
                    onChange={(v) =>
                      planMut.mutate(v[0] as "FREE" | "PREMIUM")} />
                </div>
                <p class="text-dim mt-1.5 text-xs">
                  {m.admin_users_manual_plan()}
                </p>
                {#if planMut.error}
                  <p class="text-danger mt-1.5 text-xs">{planMut.error}</p>
                {/if}
              </div>
              {#if appConfig.gamificationEnabled}
                <div class="px-4 py-3 text-sm">
                  <p class="text-fg timecode font-semibold">
                    {m.admin_users_xp_total({
                      xp: formatNumber(user.xp),
                      level: formatNumber(levelForXp(user.xp)),
                    })}
                  </p>
                  <form
                    class="mt-2 flex gap-2"
                    onsubmit={(e) => {
                      e.preventDefault();
                      adjustXp();
                    }}>
                    <input
                      type="number"
                      step="1"
                      inputmode="numeric"
                      class="input min-w-0 flex-1"
                      aria-label={m.admin_users_xp_amount()}
                      placeholder={m.admin_users_xp_amount()}
                      bind:value={xpAmount} />
                    <button
                      type="submit"
                      class="btn btn-ghost shrink-0"
                      disabled={xpMut.loading ||
                        !xpAmount ||
                        !Number.isInteger(xpAmount)}>
                      {m.admin_users_xp_apply()}
                    </button>
                  </form>
                  <p class="text-dim mt-1.5 text-xs">
                    {m.admin_users_xp_hint()}
                  </p>
                  {#if xpMut.error}
                    <p class="text-danger mt-1.5 text-xs">{xpMut.error}</p>
                  {/if}
                </div>
              {/if}
            </div>
          </div>

          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_user_journey())}
            <dl class="divide-border divide-y">
              {@render row(
                m.admin_user_arrival(),
                user.invitation
                  ? [
                      user.invitation.createdByName
                        ? m.admin_invitations_invited_by({
                            name: user.invitation.createdByName,
                          })
                        : m.admin_invitations_invited(),
                      user.invitation.label,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : m.admin_user_open_registration(),
              )}
              {@render row(
                m.admin_user_acquisition(),
                journey.acquisitionSource
                  ? journey.acquisitionSourceOther ||
                      ACQUISITION_SOURCE_LABELS[journey.acquisitionSource]()
                  : m.admin_user_not_given(),
                journey.acquisitionSource ? "text-fg" : "text-dim",
              )}
              {@render row(
                m.admin_user_onboarding(),
                journey.onboardedAt
                  ? m.admin_user_onboarding_done({
                      date: formatDate(journey.onboardedAt),
                    })
                  : m.admin_user_onboarding_pending(),
                journey.onboardedAt ? "text-fg" : "text-warning",
              )}
              {@render row(
                m.admin_user_terms(),
                journey.acceptedTermsVersion && journey.acceptedTermsAt
                  ? m.admin_user_terms_value({
                      version: journey.acceptedTermsVersion,
                      date: formatDate(journey.acceptedTermsAt),
                    })
                  : m.admin_user_not_given(),
              )}
              {@render row(
                m.admin_user_age(),
                journey.ageBracket
                  ? m.admin_user_age_value({ bracket: journey.ageBracket })
                  : m.admin_user_not_given(),
                journey.ageBracket ? "text-fg" : "text-dim",
              )}
            </dl>
          </div>
        </div>
      </section>

      <section id="library" class="scroll-mt-20" use:observeSection>
        {@render sectionTitle(m.common_library())}
        {#if libraryStatsQuery.error}
          <Banner variant="error" class="mb-2">
            <div class="flex items-center justify-between gap-2">
              <span>{libraryStatsQuery.error}</span>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                onclick={() =>
                  void queryClient.refetchQueries({
                    queryKey: keys.admin.userLibraryStats(user.id),
                  })}>{m.common_retry()}</button>
            </div>
          </Banner>
        {/if}
        {#if libraryStatsQuery.loading}
          <div class="skeleton h-24 rounded-xl"></div>
        {:else if libraryStats}
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {#each libraryTiles as stat (stat.kind)}
              <button
                type="button"
                disabled={stat.value === 0}
                onclick={() => (libraryModal = stat)}
                class="card hover:bg-surface-2 px-3 py-2.5 text-left transition-colors disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent">
                <p class="font-display text-xl font-bold">
                  {formatNumber(stat.value)}
                </p>
                <p class="text-dim text-xs">{stat.label}</p>
              </button>
            {/each}
          </div>
        {:else if !libraryStatsQuery.error}
          <p class="text-dim text-sm">{m.admin_users_stats_unavailable()}</p>
        {/if}

        <div class="mt-3 grid gap-3 md:grid-cols-2">
          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_user_recent())}
            {#if detail.recentAdditions.length}
              <ul class="divide-border divide-y">
                {#each detail.recentAdditions as work (work.id)}
                  <li class="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <Icon
                      name={DOMAINS[work.domain].icon}
                      class="h-4 w-4 shrink-0" />
                    <span class="min-w-0 flex-1 truncate">
                      {#if work.href}
                        <a href={work.href} class="hover:text-accent"
                          >{work.title}</a>
                      {:else}
                        {work.title}
                      {/if}
                    </span>
                    <span class="text-dim text-xs whitespace-nowrap"
                      >{formatRelative(work.addedAt)}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="text-dim px-4 py-3 text-sm">
                {m.admin_user_recent_empty()}
              </p>
            {/if}
          </div>

          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_user_imports())}
            {#if detail.imports.length}
              <ul class="divide-border divide-y">
                {#each detail.imports as run (run.id)}
                  <li class="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span class="min-w-0 flex-1">
                      <span class="text-fg block font-semibold"
                        >{IMPORT_SOURCE_NAMES[run.sourceId as ImportSource] ??
                          run.sourceId}</span>
                      <span class="text-dim text-xs"
                        >{m.admin_user_import_items({
                          count: formatNumber(run.itemCount),
                        })} · {formatDate(run.finishedAt)}</span>
                    </span>
                    <span
                      class="rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase {run.status ===
                      'FAILURE'
                        ? 'border-danger/40 text-danger'
                        : 'border-success/40 text-success'}">
                      {run.status === "FAILURE"
                        ? m.common_failure()
                        : m.admin_user_import_success()}
                    </span>
                  </li>
                {/each}
              </ul>
              <a
                href="/app/admin/imports?account={user.id}"
                class="link-accent border-border block border-t px-4 py-2.5 text-xs"
                >{m.admin_user_imports_all()}</a>
            {:else}
              <p class="text-dim px-4 py-3 text-sm">
                {m.admin_user_imports_empty()}
              </p>
            {/if}
          </div>
        </div>
      </section>

      <section id="security" class="scroll-mt-20" use:observeSection>
        {@render sectionTitle(m.common_security())}
        <div class="grid gap-3 md:grid-cols-2">
          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_user_login())}
            <dl class="divide-border divide-y">
              {@render row(
                m.admin_user_factor_totp(),
                user.secondFactors.includes("TOTP")
                  ? m.admin_user_on()
                  : m.common_disabled(),
                user.secondFactors.includes("TOTP")
                  ? "text-success"
                  : "text-dim",
              )}
              {@render row(
                m.admin_user_factor_email(),
                user.secondFactors.includes("EMAIL")
                  ? m.admin_user_on()
                  : m.common_disabled(),
                user.secondFactors.includes("EMAIL")
                  ? "text-success"
                  : "text-dim",
              )}
              {@render row(
                m.admin_user_passkeys(),
                formatNumber(security.passkeys),
                security.passkeys ? "text-success" : "text-dim",
              )}
              {@render row(
                m.admin_user_passwordless(),
                security.passwordless ? m.admin_user_on() : m.common_disabled(),
                security.passwordless ? "text-fg" : "text-dim",
              )}
              {@render row(
                m.admin_user_recovery_codes(),
                formatNumber(security.recoveryCodesLeft),
              )}
            </dl>
          </div>

          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_users_access())}
            <div class="p-3">
              {#if sessionsQuery.error}
                <Banner variant="error" class="mb-2">
                  <div class="flex items-center justify-between gap-2">
                    <span>{sessionsQuery.error}</span>
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      onclick={() =>
                        void queryClient.refetchQueries({
                          queryKey: keys.admin.userSessions(user.id),
                        })}>{m.common_retry()}</button>
                  </div>
                </Banner>
              {/if}
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
                        <p class="text-dim text-micro">
                          {m.common_active()}
                          {formatDate(s.lastUsedAt, DAY_MONTH_TIME_OPTIONS)}
                        </p>
                      </div>
                      <button
                        onclick={() => revokeMut.mutate(s.id)}
                        disabled={revokeMut.loading &&
                          revokeMut.variables === s.id}
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
              {:else if !sessionsQuery.error}
                <p class="text-dim text-sm">{m.admin_users_no_sessions()}</p>
              {/if}
            </div>
          </div>

          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_user_devices())}
            {#if security.devices.length || security.pushSubscriptions.length}
              <ul class="divide-border divide-y">
                {#each security.devices as device (device.id)}
                  <li class="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span class="min-w-0 flex-1 truncate"
                      >{device.userAgent ??
                        m.settings_sessions_unknown_device()}</span>
                    <span class="text-dim text-xs whitespace-nowrap"
                      >{m.admin_user_device_seen({
                        when: formatRelative(device.lastSeenAt),
                      })}</span>
                  </li>
                {/each}
                {#each security.pushSubscriptions as push (push.id)}
                  <li class="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span class="min-w-0 flex-1">
                      <span class="text-fg block font-semibold"
                        >{PUSH_PLATFORM_LABELS[push.platform]()}</span>
                      {#if push.userAgent}
                        <span class="text-dim block truncate text-xs"
                          >{push.userAgent}</span>
                      {/if}
                    </span>
                    <span class="text-dim text-xs whitespace-nowrap"
                      >{formatDate(push.createdAt)}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="text-dim px-4 py-3 text-sm">
                {m.admin_user_devices_empty()}
              </p>
            {/if}
          </div>

          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_user_api_keys())}
            {#if security.apiKeys.length}
              <ul class="divide-border divide-y">
                {#each security.apiKeys as key (key.id)}
                  <li class="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span class="min-w-0 flex-1">
                      <span class="text-fg block truncate font-semibold"
                        >{key.name}</span>
                      <span class="text-dim timecode text-xs"
                        >lk_…{key.suffix}</span>
                    </span>
                    <span class="text-dim text-xs whitespace-nowrap"
                      >{key.lastUsedAt
                        ? m.admin_user_api_key_used({
                            when: formatRelative(key.lastUsedAt),
                          })
                        : m.admin_user_api_key_never()}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="text-dim px-4 py-3 text-sm">
                {m.admin_user_api_keys_empty()}
              </p>
            {/if}
          </div>
        </div>

        <div class="card mt-3 overflow-hidden">
          {@render panelTitle(m.admin_user_security_events())}
          {#if security.events.length}
            <ul class="divide-border divide-y">
              {#each security.events as event (event.id)}
                <li
                  class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span class="min-w-0"
                    >{SECURITY_EVENT_LABELS[event.type]}</span>
                  <span class="text-dim timecode text-xs whitespace-nowrap"
                    >{formatDate(
                      event.createdAt,
                      DAY_MONTH_TIME_OPTIONS,
                    )}</span>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-dim px-4 py-3 text-sm">
              {m.admin_user_security_events_empty()}
            </p>
          {/if}
        </div>
      </section>

      <section id="preferences" class="scroll-mt-20" use:observeSection>
        {@render sectionTitle(m.admin_user_section_preferences())}
        <div class="grid gap-3 md:grid-cols-2">
          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_user_domains())}
            <div class="flex flex-wrap gap-2 px-4 py-3">
              {#each DOMAIN_IDS.filter((d) => !DOMAINS[d].comingSoon) as domain (domain)}
                {@const on = user.enabledDomains.includes(domain)}
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold {on
                    ? 'border-border'
                    : 'border-border text-dim line-through opacity-60'}">
                  <span style:color={on ? DOMAINS[domain].accent : undefined}>
                    <Icon name={DOMAINS[domain].icon} class="h-3.5 w-3.5" />
                  </span>
                  {DOMAINS[domain].label}
                </span>
              {/each}
            </div>
          </div>

          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_user_locale_region())}
            <dl class="divide-border divide-y">
              {@render row(
                m.common_language(),
                languageName(preferences.locale),
              )}
              {@render row(m.common_timezone(), preferences.timezone)}
              {@render row(
                m.admin_user_watch_region(),
                preferences.watchRegion
                  ? m.admin_user_watch_region_value({
                      region: formatRegion(preferences.watchRegion),
                      count: preferences.watchProviderCount,
                    })
                  : m.admin_user_not_given(),
                preferences.watchRegion ? "text-fg" : "text-dim",
              )}
            </dl>
          </div>

          <div class="card overflow-hidden">
            {@render panelTitle(m.common_notifications())}
            <dl class="divide-border divide-y">
              {@render row(
                m.admin_user_digest_email(),
                CADENCE_LABELS[preferences.notifyEmail](),
              )}
              {@render row(
                m.admin_user_digest_push(),
                CADENCE_LABELS[preferences.notifyPush](),
              )}
              {@render row(
                m.common_newsletter(),
                preferences.newsletter
                  ? preferences.newsletterOptInAt
                    ? m.admin_user_newsletter_on({
                        date: formatDate(preferences.newsletterOptInAt),
                      })
                    : m.admin_user_on()
                  : m.common_disabled(),
                preferences.newsletter ? "text-success" : "text-dim",
              )}
            </dl>
          </div>

          <div class="card overflow-hidden">
            {@render panelTitle(m.common_privacy())}
            <dl class="divide-border divide-y">
              {@render row(
                m.admin_user_profile_access(),
                PROFILE_ACCESS_LABELS[preferences.profileAccess](),
              )}
              {@render row(
                m.admin_user_review_default(),
                REVIEW_VISIBILITY_LABELS[preferences.defaultReviewVisibility](),
              )}
              {@render row(
                m.admin_user_adult(),
                preferences.allowAdultContent
                  ? m.admin_user_adult_shown()
                  : m.admin_user_adult_hidden(),
              )}
            </dl>
          </div>
        </div>
      </section>

      <section id="social" class="scroll-mt-20" use:observeSection>
        {@render sectionTitle(m.common_social())}
        <div class="grid gap-3 md:grid-cols-2">
          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_social_activity_title())}
            <ul class="divide-border divide-y">
              {#each ACTIVITY_SECTIONS as s (s.kind)}
                <li>
                  <button
                    type="button"
                    disabled={activityHasData(s.kind) &&
                      activityCount(s.kind) === 0}
                    onclick={() => (activeModal = s.kind)}
                    class="hover:bg-surface-2 flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent">
                    <span class="text-fg">{s.label}</span>
                    <span class="text-dim text-xs font-semibold"
                      >{activityHasData(s.kind)
                        ? activityCount(s.kind)
                        : activityError(s.kind)
                          ? m.common_unavailable()
                          : activityLoading(s.kind)
                            ? m.common_loading()
                            : m.common_disabled()}</span>
                  </button>
                </li>
              {/each}
            </ul>
          </div>

          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_user_engagement())}
            <dl class="divide-border divide-y">
              {#if appConfig.gamificationEnabled}
                {@render row(
                  m.admin_user_achievements(),
                  formatNumber(detail.engagement.achievements),
                )}
              {/if}
              {@render row(
                m.admin_user_shared_lists(),
                formatNumber(detail.engagement.sharedListMemberships),
              )}
              {@render row(
                m.admin_user_saved_views(),
                formatNumber(detail.engagement.savedViews),
              )}
            </dl>
          </div>
        </div>
      </section>

      <section id="moderation" class="scroll-mt-20" use:observeSection>
        {@render sectionTitle(m.admin_user_section_moderation())}
        <div class="grid gap-3 md:grid-cols-2">
          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_user_decisions())}
            {#if moderation.decisions.length}
              <ul class="divide-border divide-y">
                {#each moderation.decisions as decision (decision.id)}
                  <li class="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span class="min-w-0 flex-1">
                      <span class="text-fg block font-semibold"
                        >{MEASURE_LABELS[decision.measure]()}</span>
                      <span class="text-dim block text-xs"
                        >{decision.decidedByName
                          ? `${m.admin_user_decided_by({ name: decision.decidedByName })} · `
                          : ""}{decision.tosClause}</span>
                    </span>
                    <span class="text-dim timecode text-xs whitespace-nowrap"
                      >{formatDate(decision.decidedAt)}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="text-dim px-4 py-3 text-sm">
                {m.admin_user_decisions_empty()}
              </p>
            {/if}
          </div>

          <div class="card overflow-hidden">
            {@render panelTitle(m.admin_user_section_moderation())}
            <dl class="divide-border divide-y">
              <div
                class="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                <dt class="text-dim">{m.admin_user_reports_filed()}</dt>
                <dd class="font-semibold">
                  {#if moderation.reportsFiled}
                    <a
                      href="/app/admin/reports?reporter={user.id}"
                      class="link-accent"
                      >{formatNumber(moderation.reportsFiled)}</a>
                  {:else}
                    0
                  {/if}
                </dd>
              </div>
              {@render row(
                m.admin_user_blocking(),
                formatNumber(moderation.blocking),
              )}
              {@render row(
                m.admin_user_blocked_by(),
                formatNumber(moderation.blockedBy),
              )}
            </dl>
          </div>
        </div>
      </section>

      <section
        id="sensitive"
        class="border-danger/40 bg-danger/5 scroll-mt-20 rounded-xl border p-4"
        use:observeSection>
        <h2
          class="text-danger font-display mb-3 flex items-center gap-3 text-lg font-bold">
          {m.admin_users_sensitive_area()}
          <span class="bg-danger/40 h-px flex-1"></span>
        </h2>
        <div class="flex flex-wrap gap-2">
          <button
            onclick={() => verifyMut.mutate()}
            disabled={verifyMut.loading || user.emailVerified}
            class="btn btn-ghost btn-sm">
            {verifyMut.loading
              ? m.common_sending()
              : m.settings_resend_verification_email()}
          </button>
          <button
            onclick={() => resetMut.mutate()}
            disabled={resetMut.loading}
            class="btn btn-ghost btn-sm">
            {resetMut.loading ? m.common_sending() : m.admin_users_send_reset()}
          </button>
          {#if user.id === auth.user?.id}
            <p class="text-dim w-full text-xs">
              {m.admin_users_self_delete_hint()}
            </p>
          {:else}
            <button onclick={openDeleteModal} class="btn btn-danger btn-sm">
              {m.settings_delete_account_modal_title()}
            </button>
          {/if}
        </div>
      </section>
    </div>
  </div>
</div>

{#if activeModal}
  <UserActivityModal
    kind={activeModal}
    loading={activityLoading(activeModal)}
    error={activityError(activeModal)}
    {reviews}
    {comments}
    {followers}
    {following}
    {lists}
    {reportsAgainst}
    onRetry={() => activeModal && retryActivity(activeModal)}
    onClose={() => (activeModal = null)} />
{/if}

{#if libraryModal}
  <UserLibraryModal
    userId={user.id}
    kind={libraryModal.kind}
    title={libraryModal.label}
    onClose={() => (libraryModal = null)} />
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

{#if showCancelDeletionConfirm}
  <ConfirmationModal
    title={m.settings_delete_account_cancel()}
    message={m.admin_users_deletion_cancel_message({ name: user.displayName })}
    confirmLabel={m.settings_delete_account_cancel()}
    busy={cancelDeletionMut.loading}
    onConfirm={() => cancelDeletionMut.mutate()}
    onCancel={() => (showCancelDeletionConfirm = false)} />
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
