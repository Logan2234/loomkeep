<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    blockUser,
    followUser,
    getProfile,
    getUserFollowers,
    getUserFollowing,
    getUserLists,
    logout,
    unblockUser,
    unfollowUser,
  } from "$lib/api/client";
  import { ApiError } from "$lib/api/core";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import AvatarLightbox from "$lib/components/AvatarLightbox.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Carousel from "$lib/components/Carousel.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import EditAvatarModal from "$lib/components/EditAvatarModal.svelte";
  import EditProfileModal from "$lib/components/EditProfileModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import LevelBadge from "$lib/components/LevelBadge.svelte";
  import LevelCard from "$lib/components/LevelCard.svelte";
  import ListCoverGrid from "$lib/components/ListCoverGrid.svelte";
  import ListFormModal from "$lib/components/ListFormModal.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import ProfileActivity from "$lib/components/ProfileActivity.svelte";
  import ProfileReviews from "$lib/components/ProfileReviews.svelte";
  import ScanProfileModal from "$lib/components/ScanProfileModal.svelte";
  import ShareProfileModal from "$lib/components/ShareProfileModal.svelte";
  import StreakBadge from "$lib/components/StreakBadge.svelte";
  import CalendarHeatmap from "$lib/components/stats/CalendarHeatmap.svelte";
  import SectionLabel from "$lib/components/stats/SectionLabel.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { formatDate, MONTH_YEAR_OPTIONS } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    MyListDto,
    RelationshipDto,
    SocialProfileDto,
  } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";

  // Shared body for both /u/[username] (any profile, including your own —
  // read-only there even for yourself) and /profile (your own, with the
  // self-management actions). Same data either way; `publicView` is what
  // tells them apart when `rel.isSelf` is true.
  let {
    username,
    publicView = false,
  }: { username: string; publicView?: boolean } = $props();

  const DOMAIN_LABEL: Record<string, string> = {
    MEDIA: m.common_Media(),
    GAMES: m.common_Games(),
    BOOKS: m.common_Books(),
    MUSIC: m.common_Music(),
    PODCASTS: m.common_Podcasts(),
    BOARDGAMES: m.common_Boardgames(),
  };

  const DOMAIN_HREF: Record<string, string> = {
    MEDIA: "/app/media",
    GAMES: "/app/games",
    BOOKS: "/app/books",
    MUSIC: "/app/music",
  };

  const queryClient = useQueryClient();

  // notFound is set from the query's onError, and cleared once a fetch for
  // the (possibly new) username actually lands — see the $effect below.
  let notFound = $state(false);

  const profileQuery = createApiQuery(() => ({
    key: keys.profile.detail(username),
    fetch: () => getProfile(username),
    onError: (err) => {
      notFound = err instanceof ApiError && err.status === 404;
    },
  }));
  $effect(() => {
    if (profileQuery.data) notFound = false;
  });
  const profile = $derived(profileQuery.data);
  const loading = $derived(profileQuery.loading);

  let rel = $derived<RelationshipDto | null>(profile?.relationship ?? null);

  // True only on /profile viewing yourself — /u/[username] never shows
  // self-management, even for your own username (see `publicView`).
  let selfManage = $derived(rel?.isSelf && !publicView);

  // Shared/public lists visible to the viewer — social-gated (own-visibility
  // per list, see ListService.listForUser), so only fetched when enabled.
  const listsQuery = createApiQuery(() => ({
    key: keys.lists.forUser(username),
    fetch: () => getUserLists(username),
    enabled: appConfig.socialEnabled,
  }));
  const lists = $derived(listsQuery.data ?? []);

  // Own view: a "+" create tile always trails the list — a stranger only
  // ever sees the plain list previews (or nothing, hiding the section). The
  // "Tout voir" tile isn't part of this scrollable set at all: on desktop
  // it's rendered as a fixed element to the left of the carousel, on mobile
  // it's replaced by a "Gérer" link next to the section heading.
  type ListTile =
    | { kind: "create"; key: "create" }
    | { kind: "list"; key: string; list: MyListDto };
  const listTiles = $derived<ListTile[]>(
    selfManage
      ? [
          ...lists.map((l): ListTile => ({ kind: "list", key: l.id, list: l })),
          { kind: "create", key: "create" },
        ]
      : lists.map((l): ListTile => ({ kind: "list", key: l.id, list: l })),
  );

  let creatingList = $state(false);
  function handleListCreated() {
    void queryClient.invalidateQueries({
      queryKey: keys.lists.forUser(username),
    });
  }

  let memberSince = $derived(
    profile ? formatDate(profile.createdAt, MONTH_YEAR_OPTIONS) : "",
  );

  const FULL_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };

  let firstActivity = $derived(
    profile?.activityStats.firstActivityAt
      ? formatDate(profile.activityStats.firstActivityAt, FULL_DATE_OPTIONS)
      : null,
  );
  let watchDays = $derived(
    profile ? Math.round(profile.activityStats.totalMinutes / 1440) : 0,
  );
  // The heatmap teaser spans the last 90 days — count the days with any
  // activity in it, rather than the mockup's "cette année" wording (which
  // assumed a full-year window this teaser deliberately isn't).
  let activeRecentDays = $derived(
    profile
      ? profile.activityStats.heatmap.filter((d) => d.count > 0).length
      : 0,
  );

  // The primary action label reflects the relationship + the target's access.
  let followLabel = $derived.by(() => {
    if (!rel || !profile) return "";
    if (rel.following) return m.profile_follow_following();
    if (rel.requested) return m.profile_follow_requested();
    return profile.profileAccess === "PRIVATE"
      ? m.profile_follow_request()
      : m.common_follow();
  });

  // A Figurant can only follow public profiles — hide the affordance rather
  // than let them hit the backend's rejection on a private/other target.
  let ghostCantFollow = $derived(
    auth.user?.profileAccess === "GHOST" &&
      profile?.profileAccess !== "PUBLIC" &&
      !rel?.following &&
      !rel?.requested,
  );

  // Patches the cached profile in place with a fresh relationship — the
  // mutations below return it directly, so there's no need to refetch.
  function applyRelationship(next: RelationshipDto) {
    queryClient.setQueryData(
      keys.profile.detail(username),
      (old: SocialProfileDto | undefined) => {
        if (!old) return old;
        // Keep follower count roughly in sync for the common accepted-follow case.
        const wasFollowing = old.relationship.following;
        return {
          ...old,
          relationship: next,
          followerCount:
            old.followerCount +
            (next.following && !wasFollowing
              ? 1
              : !next.following && wasFollowing
                ? -1
                : 0),
        };
      },
    );
  }

  const followMut = createApiMutation(() => ({
    mutate: () =>
      rel?.following || rel?.requested
        ? unfollowUser(profile!.username)
        : followUser(profile!.username),
    onSuccess: applyRelationship,
  }));

  let confirmBlock = $state(false);
  let avatarZoomed = $state(false);

  const unblockMut = createApiMutation(() => ({
    mutate: () => unblockUser(profile!.username),
    onSuccess: applyRelationship,
  }));

  const blockMut = createApiMutation(() => ({
    mutate: () => blockUser(profile!.username),
    onSuccess: (next: RelationshipDto) => {
      applyRelationship(next);
      confirmBlock = false;
    },
  }));

  const busy = $derived(
    followMut.loading || unblockMut.loading || blockMut.loading,
  );

  function toggleFollow() {
    if (!profile) return;
    followMut.mutate();
  }

  function toggleBlock() {
    if (!profile) return;
    // Blocking is consequential (cuts the relationship both ways) — confirm
    // first. Unblocking just restores access, no confirmation needed.
    if (!rel?.blocking) {
      confirmBlock = true;
      return;
    }
    unblockMut.mutate();
  }

  function confirmBlockUser() {
    if (!profile) return;
    blockMut.mutate();
  }

  async function signOut() {
    await logout();
    await goto("/login");
  }

  let shareModalOpen = $state(false);
  let scanModalOpen = $state(false);
  let avatarModalOpen = $state(false);
  let editProfileModalOpen = $state(false);

  function applyAvatar(url: string | null) {
    queryClient.setQueryData(
      keys.profile.detail(username),
      (old: SocialProfileDto | undefined) =>
        old ? { ...old, avatarUrl: url } : old,
    );
  }

  function applyProfileEdit(user: { displayName: string; bio: string | null }) {
    queryClient.setQueryData(
      keys.profile.detail(username),
      (old: SocialProfileDto | undefined) =>
        old ? { ...old, displayName: user.displayName, bio: user.bio } : old,
    );
  }

  // Followers/following modal, opened from the counts below.
  let connectionsKind = $state<"followers" | "following" | null>(null);

  const connectionsQuery = createApiQuery(() => ({
    key: keys.profile.connections(username, connectionsKind ?? "followers"),
    fetch: () =>
      connectionsKind === "followers"
        ? getUserFollowers(username)
        : getUserFollowing(username),
    enabled: connectionsKind !== null,
  }));
  const connections = $derived(connectionsQuery.data ?? []);
  const connectionsLoading = $derived(connectionsQuery.loading);

  function openConnections(kind: "followers" | "following") {
    connectionsKind = kind;
  }
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:py-8">
  {#if loading}
    <div class="card p-6">
      <div class="flex items-center gap-4">
        <div class="skeleton h-20 w-20 rounded-md"></div>
        <div class="flex-1 space-y-2">
          <div class="skeleton h-5 w-40 rounded"></div>
          <div class="skeleton h-4 w-24 rounded"></div>
        </div>
      </div>
    </div>
  {:else if notFound || !profile}
    <div class="card flex flex-col items-center gap-3 p-10 text-center">
      <p class="font-display text-xl font-bold">
        {m.profile_not_found_title()}
      </p>
      <p class="text-dim max-w-sm text-sm">
        {m.profile_not_found_body()}
      </p>
      <a href="/app" class="btn btn-ghost mt-2">{m.common_back_home()}</a>
    </div>
  {:else if profile.locked}
    <!-- Private profile the viewer can't see yet: identity only, under embargo.
         The server withholds bio/counts/library entirely. -->
    <section class="card flex flex-col items-center gap-4 p-8 text-center">
      <div class="relative">
        <div class="blur-[6px] select-none" aria-hidden="true">
          <Avatar seed={profile.username} url={profile.avatarUrl} size={88} />
        </div>
        <div
          class="absolute inset-0 flex items-center justify-center"
          aria-hidden="true">
          <svg
            class="text-dim h-8 w-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      </div>
      <div>
        <h1 class="font-display text-2xl font-extrabold md:text-3xl">
          {profile.displayName}
        </h1>
        <p class="timecode mt-0.5 text-sm">@{profile.username}</p>
      </div>
      <p class="text-dim max-w-sm text-sm leading-relaxed">
        {m.profile_locked_message({ name: profile.displayName })}
      </p>
      {#if rel && !rel.isSelf}
        <button
          class="btn {rel.requested ? 'btn-ghost' : 'btn-primary'}"
          disabled={busy}
          onclick={toggleFollow}>
          {rel.requested
            ? m.profile_follow_cancel_request()
            : m.profile_follow_request()}
        </button>
      {/if}
    </section>
  {:else}
    {#if rel?.isSelf && publicView}
      <Banner variant="info" class="mb-4">
        {m.profile_public_view_banner()}
      </Banner>
    {/if}

    <!-- Billing block: the person credited, handle set like a film credit. -->
    <section class="card relative p-5 md:p-6">
      <!-- Reserve room on wider screens so the name/handle/meta text (which
           sits beside the avatar there, not below it) never runs under the
           icon cluster floating top-right — see below. -->
      <div
        class="flex flex-col gap-5 sm:flex-row sm:items-start {selfManage
          ? 'sm:pr-40'
          : ''}">
        <div class="relative shrink-0 self-start">
          <button
            type="button"
            class="cursor-zoom-in"
            aria-label={m.profile_avatar_zoom()}
            onclick={() => (avatarZoomed = true)}>
            <Avatar seed={profile.username} url={profile.avatarUrl} size={80} />
          </button>
          {#if selfManage}
            <button
              type="button"
              class="bg-accent text-accent-fg border-surface absolute -right-1 -bottom-1 grid h-7 w-7 place-items-center rounded-full border-2"
              aria-label={m.profile_avatar_change()}
              onclick={() => (avatarModalOpen = true)}>
              <Icon name="camera" class="h-3.5 w-3.5" />
            </button>
          {/if}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1
              class="font-display truncate text-2xl font-extrabold md:text-3xl">
              {profile.displayName}
            </h1>
            <StreakBadge
              days={profile.activityStats.visible
                ? profile.activityStats.streakDays
                : undefined} />
            {#if appConfig.gamificationEnabled}
              <LevelBadge xp={profile.xp} />
            {/if}
            {#if selfManage}
              <button
                type="button"
                class="text-dim hover:text-fg hover:bg-surface-2 rounded-full p-1"
                aria-label={m.profile_edit()}
                onclick={() => (editProfileModalOpen = true)}>
                <Icon name="edit" class="h-3.5 w-3.5" />
              </button>
            {:else if rel?.isFriend}
              <span class="chip chip-on py-1! text-xs"
                >{m.common_friends()}</span>
            {:else if rel?.followsYou}
              <span class="chip py-1! text-xs">{m.profile_follows_you()}</span>
            {/if}
          </div>
          <p
            class="text-dim mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
            <span class="timecode">@{profile.username}</span>
            {#if selfManage && auth.user}
              <span aria-hidden="true">·</span>
              <span>{auth.user.email}</span>
            {/if}
          </p>
          <p class="text-dim mt-1 flex flex-wrap items-center gap-x-2 text-sm">
            <span
              >{profile.profileAccess === "PUBLIC"
                ? m.profile_status_public()
                : profile.profileAccess === "PRIVATE"
                  ? m.profile_status_private()
                  : m.profile_ghost()}</span>
            <span aria-hidden="true">·</span>
            <span>{m.profile_member_since({ date: memberSince })}</span>
          </p>
          {#if profile.bio}
            <p class="mt-3 text-sm leading-relaxed">{profile.bio}</p>
          {/if}

          <!-- Credits: followers / following as quiet mono figures, clickable
               to list who they are. -->
          <div class="mt-4 flex flex-wrap gap-6">
            <button
              type="button"
              class="hover:text-fg"
              onclick={() => openConnections("followers")}>
              <span class="timecode text-fg text-lg font-bold"
                >{profile.followerCount}</span>
              <span class="text-dim ml-1 text-xs tracking-wide uppercase"
                >{profile.followerCount > 1
                  ? m.profile_followers_plural()
                  : m.profile_followers_singular()}</span>
            </button>
            <button
              type="button"
              class="hover:text-fg"
              onclick={() => openConnections("following")}>
              <span class="timecode text-fg text-lg font-bold"
                >{profile.followingCount}</span>
              <span class="text-dim ml-1 text-xs tracking-wide uppercase"
                >{profile.followingCount > 1
                  ? m.profile_following_plural()
                  : m.profile_following_singular()}</span>
            </button>
          </div>
        </div>
      </div>

      {#if appConfig.gamificationEnabled && profile.xp !== null}
        <div class="mt-5">
          <LevelCard xp={profile.xp} />
        </div>
      {/if}

      {#if rel && !rel.isSelf}
        <!-- Own row below the avatar/info block instead of sharing it — the
             card is capped at max-w-3xl, and buttons competing with the info
             column for that width squeezed it down to almost nothing (forced
             the follower/following figures to wrap onto separate lines). -->
        <div class="border-border mt-5 flex flex-wrap gap-2 border-t pt-5">
          {#if rel.blocking}
            <button class="btn btn-ghost" disabled={busy} onclick={toggleBlock}>
              {m.common_unblock()}
            </button>
          {:else}
            {#if !ghostCantFollow}
              <button
                class="btn {rel.following || rel.requested
                  ? 'btn-ghost'
                  : 'btn-primary'}"
                disabled={busy}
                onclick={toggleFollow}>
                {followLabel}
              </button>
            {/if}
            <button
              class="btn btn-ghost"
              disabled={busy}
              title={m.common_block()}
              aria-label={m.common_block()}
              onclick={toggleBlock}>
              {m.common_block()}
            </button>
          {/if}
        </div>
      {:else if rel?.isSelf && publicView}
        <!-- Your own profile, viewed the way anyone else sees it — no
             self-management here, just a way back to the real thing. -->
        <a
          href="/app/profile"
          class="border-border text-dim hover:bg-surface-2 hover:text-fg absolute top-5 right-5 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold md:top-6 md:right-6">
          <Icon name="chevron-left" class="h-3.5 w-3.5" />
          {m.profile_back_to_own()}
        </a>
      {:else if selfManage}
        <!-- Icon-only, top-right of the card, flush with its own padding —
             lighter than a labelled button row/grid. Scanning is dropped
             past sm: it's a "point your phone at theirs" action that doesn't
             make sense on a laptop. -->
        <div class="absolute top-5 right-5 flex gap-1.5 md:top-6 md:right-6">
          {#if appConfig.gamificationEnabled}
            <!-- [G5] the single doorway to /app/achievements, deliberately
                 dumb (no counter, no badge): [G9]'s equipped showcase is
                 expected to replace it. Own profile only — the page shows
                 your achievements and nobody else's. -->
            <a
              href="/app/achievements"
              class="border-border text-dim hover:bg-surface-2 hover:text-fg relative grid h-9 w-9 place-items-center rounded-full border"
              title={m.gamification_my_achievements()}
              aria-label={m.gamification_my_achievements()}>
              <Icon name="trophy" class="h-4 w-4" />
              {#if isFeatureNew("achievements")}
                <span class="absolute -top-1.5 -right-1.5">
                  <NewBadge />
                </span>
              {/if}
            </a>
          {/if}
          <button
            type="button"
            class="border-border text-dim hover:bg-surface-2 hover:text-fg grid h-9 w-9 place-items-center rounded-full border"
            title={m.share_profile_title()}
            aria-label={m.share_profile_title()}
            onclick={() => (shareModalOpen = true)}>
            <Icon name="share" class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="border-border text-dim hover:bg-surface-2 hover:text-fg grid h-9 w-9 place-items-center rounded-full border sm:hidden"
            title={m.scan_profile_title()}
            aria-label={m.scan_profile_title()}
            onclick={() => (scanModalOpen = true)}>
            <Icon name="camera" class="h-4 w-4" />
          </button>
          <a
            href="/app/settings"
            class="border-border text-dim hover:bg-surface-2 hover:text-fg grid h-9 w-9 place-items-center rounded-full border"
            title={m.common_settings()}
            aria-label={m.common_settings()}>
            <Icon name="gear" class="h-4 w-4" />
          </a>
          <button
            type="button"
            class="border-danger/40 text-danger hover:bg-danger/10 grid h-9 w-9 place-items-center rounded-full border"
            title={m.common_logout()}
            aria-label={m.common_logout()}
            onclick={signOut}>
            <Icon name="logout" class="h-4 w-4" />
          </button>
        </div>
      {/if}
    </section>

    <!-- Per-domain library, gated by the viewer's visibility. -->
    <SectionLabel label={m.common_library()} class="mt-8 mb-3" />
    <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {#each profile.domains as d (d.domain)}
        {@const href = selfManage ? DOMAIN_HREF[d.domain] : undefined}
        <svelte:element
          this={href ? "a" : "div"}
          {href}
          class="card p-4 {href
            ? 'hover:border-accent transition-colors'
            : ''}">
          <p class="text-dim text-xs font-semibold tracking-wide uppercase">
            {DOMAIN_LABEL[d.domain] ?? d.domain}
          </p>
          {#if d.visible}
            <p class="timecode text-fg mt-1 text-2xl font-bold">{d.count}</p>
            <p class="text-dim text-xs">
              {d.count > 1 ? m.library_title_many() : m.library_title_one()}
            </p>
            {#if d.favorites > 0}
              <p
                class="text-accent mt-1.5 flex items-center gap-1 text-xs font-bold">
                ♥ {d.favorites}
                {d.favorites > 1
                  ? m.profile_favorite_many()
                  : m.profile_favorite_one()}
              </p>
            {/if}
          {:else}
            <p class="text-dim mt-1 text-sm">{m.common_private()}</p>
          {/if}
        </svelte:element>
      {/each}
    </section>

    <!-- Cross-domain video figures + social counters, gated the same way as
         the streak above (activityStats: MEDIA Activité facet; social counts:
         each type's own visibility rule). -->
    {#if (profile.activityStats.visible && (watchDays > 0 || profile.activityStats.mostActiveYear !== null || profile.activityStats.topGenres.length > 0)) || profile.reviewsCount > 0 || profile.commentsCount > 0 || profile.listsCount > 0}
      <SectionLabel label={m.profile_stats_section()} class="mt-8 mb-3" />

      {#if profile.activityStats.visible && (watchDays > 0 || profile.activityStats.mostActiveYear !== null)}
        <div
          class="border-border flex flex-wrap overflow-hidden rounded-xl border">
          {#if watchDays > 0}
            <div class="border-border min-w-35 flex-1 border-r border-b p-3.5">
              <p class="font-display text-xl font-extrabold tracking-tight">
                {watchDays}<span class="text-dim text-xs font-bold">
                  {m.common_days_short()}</span>
              </p>
              <p class="text-dim mt-0.5 text-xs">
                {m.profile_watch_time_cumulative()}
              </p>
            </div>
          {/if}
          {#if profile.activityStats.mostActiveYear !== null}
            <div class="min-w-35 flex-1 border-b p-3.5">
              <p class="font-display text-xl font-extrabold tracking-tight">
                {profile.activityStats.mostActiveYear}
              </p>
              <p class="text-dim mt-0.5 text-xs">
                {m.profile_most_active_year()}
              </p>
            </div>
          {/if}
        </div>
      {/if}

      {#if profile.activityStats.topGenres.length > 0}
        <div class="mt-2.5 flex flex-wrap gap-1.5">
          {#each profile.activityStats.topGenres as g (g.label)}
            <span
              class="bg-surface-2 border-border rounded-full border px-2.5 py-1 text-xs">
              {g.label}<b class="timecode ml-1 font-normal">{g.count}</b>
            </span>
          {/each}
        </div>
      {/if}

      {#if profile.reviewsCount > 0 || profile.commentsCount > 0 || profile.listsCount > 0}
        <div
          class="border-border mt-3 flex flex-wrap gap-5 border-t pt-3 text-sm">
          {#if profile.reviewsCount > 0}
            <div>
              <span class="timecode text-fg font-bold"
                >{profile.reviewsCount}</span>
              <span class="text-dim ml-1 text-xs"
                >{profile.reviewsCount > 1
                  ? m.profile_reviews_count_plural()
                  : m.profile_reviews_count_singular()}</span>
            </div>
          {/if}
          {#if profile.commentsCount > 0}
            <div>
              <span class="timecode text-fg font-bold"
                >{profile.commentsCount}</span>
              <span class="text-dim ml-1 text-xs"
                >{m.profile_comments_count()}</span>
            </div>
          {/if}
          {#if profile.listsCount > 0}
            <div>
              <span class="timecode text-fg font-bold"
                >{profile.listsCount}</span>
              <span class="text-dim ml-1 text-xs"
                >{profile.listsCount > 1
                  ? m.profile_lists_count_plural()
                  : m.profile_lists_count_singular()}</span>
            </div>
          {/if}
        </div>
      {/if}
    {/if}

    <!-- Mini activity heatmap teaser (video-only) — the card itself isn't a
         link, only the "voir tout" line is, matching the mockup. -->
    {#if profile.activityStats.visible && profile.activityStats.heatmap.some((d) => d.count > 0)}
      <SectionLabel label={m.common_activity()} class="mt-8 mb-3" />
      <div class="card flex flex-wrap items-center gap-3.5 p-4">
        <CalendarHeatmap
          days={profile.activityStats.heatmap}
          legend={false}
          compact />
        <div class="text-sm">
          <p>
            {m.common_active()}
            <b class="font-bold"
              >{m.profile_activity_days({ days: activeRecentDays })}</b>
            {m.profile_activity_summary_suffix()}{#if firstActivity}
              {m.profile_activity_first_trace({ date: firstActivity })}{/if}
          </p>
          <a
            href="/app/stats"
            class="btn-text text-accent hover:text-accent mt-0.5">
            {m.profile_activity_view_stats()}
          </a>
        </div>
      </div>
    {/if}

    {#if appConfig.socialEnabled && listTiles.length > 0}
      <section class="mt-10">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-display text-xl font-bold">
            {m.common_lists()}
          </h2>
          {#if selfManage && lists.length > 0}
            <a
              href="/app/lists"
              class="text-dim hover:text-accent flex items-center gap-1 text-sm font-semibold md:hidden">
              {m.common_manage()}
              <Icon name="chevron-right" class="h-4 w-4" />
            </a>
          {/if}
        </div>
        <div class="flex items-stretch gap-4">
          {#if selfManage && lists.length > 0}
            <a
              href="/app/lists"
              class="mt-2 hidden w-28 shrink-0 sm:w-32 md:block">
              <div
                class="card hover:border-accent text-dim hover:text-accent flex aspect-2/3 flex-col items-center justify-center gap-1.5 transition-colors">
                <Icon name="list" class="h-6 w-6" />
                <span class="text-xs font-semibold">{m.common_view_all()}</span>
              </div>
            </a>
          {/if}
          <div class="min-w-0 flex-1">
            <Carousel items={listTiles} keyOf={(item) => item.key}>
              {#snippet card(item)}
                {#if item.kind === "create"}
                  <button
                    type="button"
                    onclick={() => (creatingList = true)}
                    class="w-28 self-start sm:w-32">
                    <div
                      class="card text-dim hover:border-accent hover:text-accent flex aspect-2/3 flex-col items-center justify-center gap-1.5 border-dashed transition-colors">
                      <Icon name="plus" class="h-6 w-6" />
                      <span class="text-xs font-semibold"
                        >{m.common_create()}</span>
                    </div>
                  </button>
                {:else}
                  <a
                    href="/app/lists/{item.list.id}"
                    class="block w-28 sm:w-32">
                    <div
                      class="card hover:border-accent overflow-hidden transition-colors">
                      <ListCoverGrid
                        images={item.list.previewImageUrls}
                        title={item.list.title} />
                    </div>
                    <p class="mt-1.5 truncate text-xs font-semibold">
                      {item.list.title}
                    </p>
                    {#if item.list.role === "EDITOR"}
                      <p class="text-dim truncate text-[0.65rem]">
                        {m.list_owned_by_editor({
                          name: item.list.author.displayName,
                        })}
                      </p>
                    {/if}
                  </a>
                {/if}
              {/snippet}
            </Carousel>
          </div>
        </div>
      </section>
    {/if}

    {#if selfManage}
      <ProfileReviews />
    {/if}

    <!-- Recent activity (visibility-filtered server-side; self-hides if empty). -->
    <ProfileActivity username={profile.username} />
  {/if}
</div>

{#if connectionsKind}
  <Modal
    title={connectionsKind === "followers"
      ? m.profile_connections_followers_title()
      : m.profile_connections_following_title()}
    onclose={() => (connectionsKind = null)}>
    {#if connectionsLoading}
      <div class="space-y-3">
        {#each { length: 4 } as _, i (i)}
          <div class="flex items-center gap-3">
            <div class="skeleton h-9 w-9 rounded-full"></div>
            <div class="skeleton h-4 w-32 rounded"></div>
          </div>
        {/each}
      </div>
    {:else if connections.length === 0}
      <p class="text-dim text-sm">
        {connectionsKind === "followers"
          ? m.profile_connections_empty_followers()
          : m.profile_connections_empty_following()}
      </p>
    {:else}
      <ul class="max-h-96 space-y-1 overflow-y-auto">
        {#each connections as u (u.id)}
          <li>
            <a
              href={`/app/u/${u.username}`}
              class="hover:bg-surface-2 flex items-center gap-3 rounded-lg p-2"
              onclick={() => (connectionsKind = null)}>
              <Avatar seed={u.username} url={u.avatarUrl} size={36} />
              <span class="min-w-0">
                <span class="block truncate text-sm font-semibold"
                  >{u.displayName}</span>
                <span class="timecode block truncate text-xs"
                  >@{u.username}</span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </Modal>
{/if}

{#if confirmBlock && profile}
  <ConfirmationModal
    title={m.profile_block_confirm_title({ name: profile.displayName })}
    message={m.profile_block_confirm_message({ name: profile.displayName })}
    confirmLabel={m.common_block()}
    danger
    {busy}
    onConfirm={confirmBlockUser}
    onCancel={() => (confirmBlock = false)} />
{/if}

{#if shareModalOpen && profile}
  <ShareProfileModal
    username={profile.username}
    displayName={profile.displayName}
    onclose={() => (shareModalOpen = false)} />
{/if}

{#if scanModalOpen}
  <ScanProfileModal onclose={() => (scanModalOpen = false)} />
{/if}

{#if avatarModalOpen && profile}
  <EditAvatarModal
    seed={profile.username}
    avatarUrl={profile.avatarUrl}
    onSaved={applyAvatar}
    onclose={() => (avatarModalOpen = false)} />
{/if}

{#if editProfileModalOpen && profile}
  <EditProfileModal
    displayName={profile.displayName}
    bio={profile.bio}
    onSaved={applyProfileEdit}
    onclose={() => (editProfileModalOpen = false)} />
{/if}

{#if avatarZoomed && profile}
  <AvatarLightbox
    seed={profile.username}
    url={profile.avatarUrl}
    onClose={() => (avatarZoomed = false)} />
{/if}

{#if creatingList}
  <ListFormModal
    defaultVisibility={auth.user?.defaultListVisibility ?? "PRIVATE"}
    onClose={() => (creatingList = false)}
    onSaved={handleListCreated} />
{/if}
