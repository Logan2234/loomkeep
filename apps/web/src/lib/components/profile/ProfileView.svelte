<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    blockUser,
    followUser,
    getMyProfile,
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
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import EditAvatarModal from "$lib/components/EditAvatarModal.svelte";
  import EditProfileModal from "$lib/components/EditProfileModal.svelte";
  import ListFormModal from "$lib/components/ListFormModal.svelte";
  import ProfileActivity from "$lib/components/ProfileActivity.svelte";
  import ProfileConnectionsModal from "$lib/components/profile/ProfileConnectionsModal.svelte";
  import ProfileHeader from "$lib/components/profile/ProfileHeader.svelte";
  import ProfileLibrarySection from "$lib/components/profile/ProfileLibrarySection.svelte";
  import ProfileListsSection from "$lib/components/profile/ProfileListsSection.svelte";
  import ProfileStatsCard from "$lib/components/profile/ProfileStatsCard.svelte";
  import ProfileReviews from "$lib/components/ProfileReviews.svelte";
  import ScanProfileModal from "$lib/components/ScanProfileModal.svelte";
  import ShareProfileModal from "$lib/components/ShareProfileModal.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { formatDate, MONTH_YEAR_OPTIONS } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    MyListDto,
    RelationshipDto,
    SocialProfileDto,
  } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import LevelCard from "../LevelCard.svelte";
  import BadgeShowcase from "../BadgeShowcase.svelte";

  // Shared body for both /u/[username] (any profile, including your own —
  // read-only there even for yourself) and /profile (your own, with the
  // self-management actions). Same data either way; `publicView` is what
  // tells them apart when `rel.isSelf` is true.
  let {
    username,
    publicView = false,
  }: { username: string; publicView?: boolean } = $props();

  const queryClient = useQueryClient();

  // notFound is set from the query's onError, and cleared once a fetch for
  // the (possibly new) username actually lands — see the $effect below.
  let notFound = $state(false);

  // Your own profile has its own endpoint outside the social module, which
  // is the only one reachable when SOCIAL_ENABLED is off. Same payload, so
  // nothing below this line needs to know which one answered.
  const isOwnProfile = $derived(auth.user?.username === username);

  const profileQuery = createApiQuery(() => ({
    key: keys.profile.detail(username),
    fetch: () =>
      isOwnProfile && !appConfig.socialEnabled
        ? getMyProfile()
        : getProfile(username),
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

<div class="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
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

    <!-- Identity + progression, side by side: two cards of matching chrome
         rather than one card that grows to swallow the other. No
         items-start — the row stretches both to the taller card's height
         (grid's default), so whichever one has less content (no bio, no
         equipped badges…) still reaches the same bottom edge instead of
         leaving a gap before the next section. Collapses to a single
         column — no explicit lg:grid-cols-* — whenever there's no
         progression panel to sit beside (gamification off, or xp withheld). -->
    {@const xp = profile.xp}
    <div
      class="grid gap-5 lg:gap-7 {appConfig.gamificationEnabled && xp !== null
        ? 'lg:grid-cols-[1fr_358px]'
        : ''}">
      <ProfileHeader
        {profile}
        {rel}
        {selfManage}
        {publicView}
        {busy}
        {followLabel}
        {ghostCantFollow}
        {memberSince}
        onToggleFollow={toggleFollow}
        onToggleBlock={toggleBlock}
        onSignOut={signOut}
        onOpenAvatarZoom={() => (avatarZoomed = true)}
        onOpenAvatarModal={() => (avatarModalOpen = true)}
        onOpenEditProfile={() => (editProfileModalOpen = true)}
        onOpenShareModal={() => (shareModalOpen = true)}
        onOpenScanModal={() => (scanModalOpen = true)}
        onOpenConnections={openConnections} />
      {#if appConfig.gamificationEnabled && xp !== null}
        <aside class="card self-start p-5 md:p-6">
          <LevelCard
            {xp}
            leaderboardHref={selfManage && appConfig.socialEnabled
              ? "/app/leaderboard"
              : undefined}
            achievementsHref={selfManage ? "/app/achievements" : undefined} />
          <div class="mt-6">
            <BadgeShowcase badges={profile.equippedBadges} />
          </div>
        </aside>
      {/if}
    </div>

    <!-- Wide column: what the viewer produces. Narrow column: what they're
         measured on. Every section is its own grid item (not nested inside
         a wide-column wrapper) so mobile can order them independently of
         where they land on desktop: "En chiffres" reads right after the
         library there, not stranded at the very bottom under activity —
         `order-*` drives the single mobile column, `lg:col-start-*` +
         `lg:row-span-*` place them into the two desktop columns instead. -->
    <div
      class="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_358px] lg:gap-7">
      <div class="order-1 min-w-0 lg:order-0 lg:col-start-1">
        <ProfileLibrarySection domains={profile.domains} {selfManage} />
      </div>

      <div class="order-2 min-w-0 lg:order-0 lg:col-start-2 lg:row-span-4">
        <ProfileStatsCard {profile} />
      </div>

      {#if appConfig.socialEnabled && listTiles.length > 0}
        <div class="order-3 min-w-0 lg:order-0 lg:col-start-1">
          <ProfileListsSection
            {listTiles}
            {selfManage}
            hasOwnLists={lists.length > 0}
            onCreateList={() => (creatingList = true)} />
        </div>
      {/if}

      {#if selfManage}
        <div class="order-4 min-w-0 lg:order-0 lg:col-start-1">
          <ProfileReviews />
        </div>
      {/if}

      <div class="order-5 min-w-0 lg:order-0 lg:col-start-1">
        <ProfileActivity username={profile.username} />
      </div>
    </div>
  {/if}
</div>

{#if connectionsKind}
  <ProfileConnectionsModal
    kind={connectionsKind}
    {connections}
    loading={connectionsLoading}
    onClose={() => (connectionsKind = null)} />
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
