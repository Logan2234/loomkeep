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
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import AvatarLightbox from "$lib/components/AvatarLightbox.svelte";
  import Carousel from "$lib/components/Carousel.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import EditAvatarModal from "$lib/components/EditAvatarModal.svelte";
  import EditProfileModal from "$lib/components/EditProfileModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import ListCoverGrid from "$lib/components/ListCoverGrid.svelte";
  import ListFormModal from "$lib/components/ListFormModal.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import ProfileActivity from "$lib/components/ProfileActivity.svelte";
  import ProfileReviews from "$lib/components/ProfileReviews.svelte";
  import ScanProfileModal from "$lib/components/ScanProfileModal.svelte";
  import ShareProfileModal from "$lib/components/ShareProfileModal.svelte";
  import StreakBadge from "$lib/components/StreakBadge.svelte";
  import CalendarHeatmap from "$lib/components/stats/CalendarHeatmap.svelte";
  import SectionLabel from "$lib/components/stats/SectionLabel.svelte";
  import { appConfig } from "$lib/config.svelte";
  import type {
    ListDto,
    MyListDto,
    RelationshipDto,
    SocialProfileDto,
    UserSummaryDto,
  } from "@loomkeep/shared";

  // Shared body for both /u/[username] (any profile) and /profile (the
  // current user's own, via the isSelf branch below — same data, same card,
  // just the extra self-management actions).
  let { username }: { username: string } = $props();

  const DOMAIN_LABEL: Record<string, string> = {
    MEDIA: "Vidéo",
    GAMES: "Jeux",
    BOOKS: "Livres",
    MUSIC: "Musique",
    PODCASTS: "Podcasts",
    BOARDGAMES: "Jeux de société",
  };

  const DOMAIN_HREF: Record<string, string> = {
    MEDIA: "/media",
    GAMES: "/games",
    BOOKS: "/books",
    MUSIC: "/music",
  };

  let profile = $state<SocialProfileDto | null>(null);
  let notFound = $state(false);
  let loading = $state(true);
  let busy = $state(false);

  $effect(() => {
    // Re-fetch whenever the target username changes.
    const name = username;
    loading = true;
    notFound = false;
    profile = null;
    getProfile(name)
      .then((p) => (profile = p))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) notFound = true;
      })
      .finally(() => (loading = false));
  });

  let rel = $derived<RelationshipDto | null>(profile?.relationship ?? null);

  // Shared/public lists visible to the viewer — social-gated (own-visibility
  // per list, see ListService.listForUser), so only fetched when enabled.
  let lists = $state<MyListDto[]>([]);
  $effect(() => {
    const name = username;
    lists = [];
    if (!appConfig.socialEnabled) return;
    getUserLists(name)
      .then((r) => (lists = r))
      .catch(() => (lists = []));
  });

  // Own view: a "+" create tile always trails the list — a stranger only
  // ever sees the plain list previews (or nothing, hiding the section). The
  // "Tout voir" tile isn't part of this scrollable set at all: on desktop
  // it's rendered as a fixed element to the left of the carousel, on mobile
  // it's replaced by a "Gérer" link next to the section heading.
  type ListTile =
    | { kind: "create"; key: "create" }
    | { kind: "list"; key: string; list: MyListDto };
  const listTiles = $derived<ListTile[]>(
    rel?.isSelf
      ? [
          ...lists.map((l): ListTile => ({ kind: "list", key: l.id, list: l })),
          { kind: "create", key: "create" },
        ]
      : lists.map((l): ListTile => ({ kind: "list", key: l.id, list: l })),
  );

  let creatingList = $state(false);
  function handleListCreated(list: ListDto) {
    lists = [{ ...list, itemCount: 0, previewImageUrls: [] }, ...lists];
  }

  let memberSince = $derived(
    profile
      ? new Intl.DateTimeFormat("fr-FR", {
          month: "long",
          year: "numeric",
        }).format(new Date(profile.createdAt))
      : "",
  );

  const shortDate = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  let firstActivity = $derived(
    profile?.activityStats.firstActivityAt
      ? shortDate.format(new Date(profile.activityStats.firstActivityAt))
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
    if (rel.following) return "Suivi";
    if (rel.requested) return "Demande envoyée";
    return profile.profileAccess === "PRIVATE" ? "Demander à suivre" : "Suivre";
  });

  // A Figurant can only follow public profiles — hide the affordance rather
  // than let them hit the backend's rejection on a private/other target.
  let ghostCantFollow = $derived(
    auth.user?.profileAccess === "GHOST" &&
      profile?.profileAccess !== "PUBLIC" &&
      !rel?.following &&
      !rel?.requested,
  );

  function applyRelationship(next: RelationshipDto) {
    if (!profile) return;
    // Keep follower count roughly in sync for the common accepted-follow case.
    const wasFollowing = profile.relationship.following;
    profile = {
      ...profile,
      relationship: next,
      followerCount:
        profile.followerCount +
        (next.following && !wasFollowing
          ? 1
          : !next.following && wasFollowing
            ? -1
            : 0),
    };
  }

  async function toggleFollow() {
    if (!profile || busy) return;
    busy = true;
    try {
      const next =
        rel?.following || rel?.requested
          ? await unfollowUser(profile.username)
          : await followUser(profile.username);
      applyRelationship(next);
    } finally {
      busy = false;
    }
  }

  let confirmBlock = $state(false);
  let avatarZoomed = $state(false);

  async function toggleBlock() {
    if (!profile || busy) return;
    // Blocking is consequential (cuts the relationship both ways) — confirm
    // first. Unblocking just restores access, no confirmation needed.
    if (!rel?.blocking) {
      confirmBlock = true;
      return;
    }
    busy = true;
    try {
      const next = await unblockUser(profile.username);
      applyRelationship(next);
    } finally {
      busy = false;
    }
  }

  async function confirmBlockUser() {
    if (!profile || busy) return;
    busy = true;
    try {
      const next = await blockUser(profile.username);
      applyRelationship(next);
    } finally {
      busy = false;
      confirmBlock = false;
    }
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
    if (profile) profile = { ...profile, avatarUrl: url };
  }

  function applyProfileEdit(user: { displayName: string; bio: string | null }) {
    if (profile)
      profile = { ...profile, displayName: user.displayName, bio: user.bio };
  }

  // Followers/following modal, opened from the counts below.
  let connectionsKind = $state<"followers" | "following" | null>(null);
  let connections = $state<UserSummaryDto[]>([]);
  let connectionsLoading = $state(false);

  async function openConnections(kind: "followers" | "following") {
    connectionsKind = kind;
    connectionsLoading = true;
    connections = [];
    try {
      connections = await (kind === "followers"
        ? getUserFollowers(username)
        : getUserFollowing(username));
    } finally {
      connectionsLoading = false;
    }
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
      <p class="font-display text-xl font-bold">Profil introuvable</p>
      <p class="text-dim max-w-sm text-sm">
        Ce profil n'existe pas, ou il n'est pas visible pour vous.
      </p>
      <a href="/" class="btn btn-ghost mt-2">Retour à l'accueil</a>
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
        Ce profil est privé. Demandez à suivre {profile.displayName} pour voir sa
        bibliothèque et son activité.
      </p>
      {#if rel && !rel.isSelf}
        <button
          class="btn {rel.requested ? 'btn-ghost' : 'btn-primary'}"
          disabled={busy}
          onclick={toggleFollow}>
          {rel.requested ? "Annuler la demande" : "Demander à suivre"}
        </button>
      {/if}
    </section>
  {:else}
    <!-- Billing block: the person credited, handle set like a film credit. -->
    <section class="card p-5 md:p-6">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div class="relative shrink-0">
          <button
            type="button"
            class="cursor-zoom-in"
            aria-label="Agrandir l'avatar"
            onclick={() => (avatarZoomed = true)}>
            <Avatar seed={profile.username} url={profile.avatarUrl} size={80} />
          </button>
          {#if rel?.isSelf}
            <button
              type="button"
              class="bg-accent text-accent-fg border-surface absolute -right-1 -bottom-1 grid h-7 w-7 place-items-center rounded-full border-2"
              aria-label="Changer la photo de profil"
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
            {#if rel?.isSelf}
              <button
                type="button"
                class="text-dim hover:text-fg hover:bg-surface-2 rounded-full p-1"
                aria-label="Modifier le profil"
                onclick={() => (editProfileModalOpen = true)}>
                <Icon name="edit" class="h-3.5 w-3.5" />
              </button>
            {:else if rel?.isFriend}
              <span class="chip chip-on !py-1 text-xs">Amis</span>
            {:else if rel?.followsYou}
              <span class="chip !py-1 text-xs">Vous suit</span>
            {/if}
          </div>
          <p
            class="text-dim mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
            <span class="timecode">@{profile.username}</span>
            {#if rel?.isSelf && auth.user}
              <span aria-hidden="true">·</span>
              <span>{auth.user.email}</span>
            {/if}
          </p>
          <p class="text-dim mt-1 flex flex-wrap items-center gap-x-2 text-sm">
            <span
              >{profile.profileAccess === "PUBLIC"
                ? "Profil public"
                : profile.profileAccess === "PRIVATE"
                  ? "Profil privé"
                  : "Figurant"}</span>
            <span aria-hidden="true">·</span>
            <span>Membre depuis {memberSince}</span>
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
                >{profile.followerCount > 1 ? "abonnés" : "abonné"}</span>
            </button>
            <button
              type="button"
              class="hover:text-fg"
              onclick={() => openConnections("following")}>
              <span class="timecode text-fg text-lg font-bold"
                >{profile.followingCount}</span>
              <span class="text-dim ml-1 text-xs tracking-wide uppercase"
                >{profile.followingCount > 1
                  ? "abonnements"
                  : "abonnement"}</span>
            </button>
          </div>
        </div>

        {#if rel && !rel.isSelf}
          <div class="flex shrink-0 gap-2">
            {#if rel.blocking}
              <button
                class="btn btn-ghost"
                disabled={busy}
                onclick={toggleBlock}>
                Débloquer
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
                title="Bloquer"
                aria-label="Bloquer"
                onclick={toggleBlock}>
                Bloquer
              </button>
            {/if}
          </div>
        {:else if rel?.isSelf}
          <!-- Mobile: an even 2×2 grid so 4 actions never wrap into a ragged
               row on a narrow screen. Desktop: back to the usual inline row,
               scanning dropped since it's a "point your phone at theirs"
               action that doesn't make sense on a laptop. -->
          <div class="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0">
            <button
              class="btn btn-ghost"
              onclick={() => (shareModalOpen = true)}>
              <Icon name="share" class="h-4 w-4" /> Partager
            </button>
            <button
              class="btn btn-ghost sm:hidden"
              onclick={() => (scanModalOpen = true)}>
              <Icon name="camera" class="h-4 w-4" /> Scanner
            </button>
            <a href="/settings" class="btn btn-ghost">
              <Icon name="gear" class="h-4 w-4" /> Paramètres
            </a>
            <button class="btn btn-danger" onclick={signOut}>
              Se déconnecter
            </button>
          </div>
        {/if}
      </div>
    </section>

    <!-- Per-domain library, gated by the viewer's visibility. -->
    <SectionLabel label="Bibliothèque" class="mt-8 mb-3" />
    <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {#each profile.domains as d (d.domain)}
        {@const href = rel?.isSelf ? DOMAIN_HREF[d.domain] : undefined}
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
              {d.count > 1 ? "titres" : "titre"}
            </p>
            {#if d.favorites > 0}
              <p
                class="text-accent mt-1.5 flex items-center gap-1 text-xs font-bold">
                ♥ {d.favorites} favori{d.favorites > 1 ? "s" : ""}
              </p>
            {/if}
          {:else}
            <p class="text-dim mt-1 text-sm">Privé</p>
          {/if}
        </svelte:element>
      {/each}
    </section>

    <!-- Cross-domain video figures + social counters, gated the same way as
         the streak above (activityStats: MEDIA Activité facet; social counts:
         each type's own visibility rule). -->
    {#if (profile.activityStats.visible && (watchDays > 0 || profile.activityStats.mostActiveYear !== null || profile.activityStats.topGenres.length > 0)) || profile.reviewsCount > 0 || profile.commentsCount > 0 || profile.listsCount > 0}
      <SectionLabel label="En chiffres" class="mt-8 mb-3" />

      {#if profile.activityStats.visible && (watchDays > 0 || profile.activityStats.mostActiveYear !== null)}
        <div
          class="border-border flex flex-wrap overflow-hidden rounded-xl border">
          {#if watchDays > 0}
            <div
              class="border-border min-w-[140px] flex-1 border-r border-b p-3.5">
              <p class="font-display text-xl font-extrabold tracking-tight">
                {watchDays}<span class="text-dim text-xs font-bold"> j</span>
              </p>
              <p class="text-dim mt-0.5 text-xs">Temps cumulé</p>
            </div>
          {/if}
          {#if profile.activityStats.mostActiveYear !== null}
            <div class="min-w-[140px] flex-1 border-b p-3.5">
              <p class="font-display text-xl font-extrabold tracking-tight">
                {profile.activityStats.mostActiveYear}
              </p>
              <p class="text-dim mt-0.5 text-xs">Année la plus active</p>
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
                >{profile.reviewsCount > 1 ? "critiques" : "critique"}</span>
            </div>
          {/if}
          {#if profile.commentsCount > 0}
            <div>
              <span class="timecode text-fg font-bold"
                >{profile.commentsCount}</span>
              <span class="text-dim ml-1 text-xs">commentaires</span>
            </div>
          {/if}
          {#if profile.listsCount > 0}
            <div>
              <span class="timecode text-fg font-bold"
                >{profile.listsCount}</span>
              <span class="text-dim ml-1 text-xs"
                >{profile.listsCount > 1 ? "listes" : "liste"}</span>
            </div>
          {/if}
        </div>
      {/if}
    {/if}

    <!-- Mini activity heatmap teaser (video-only) — the card itself isn't a
         link, only the "voir tout" line is, matching the mockup. -->
    {#if profile.activityStats.visible && profile.activityStats.heatmap.some((d) => d.count > 0)}
      <SectionLabel label="Activité" class="mt-8 mb-3" />
      <div class="card flex flex-wrap items-center gap-3.5 p-4">
        <CalendarHeatmap
          days={profile.activityStats.heatmap}
          legend={false}
          compact />
        <div class="text-sm">
          <p>
            Actif <b class="font-bold">{activeRecentDays} jours</b> ces 3
            derniers mois{#if firstActivity}
              · première trace le {firstActivity}{/if}
          </p>
          <a
            href="/stats"
            class="text-accent mt-0.5 inline-block text-xs font-bold hover:underline">
            Voir toute l’activité dans les statistiques →
          </a>
        </div>
      </div>
    {/if}

    {#if appConfig.socialEnabled && listTiles.length > 0}
      <section class="mt-10">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-display text-xl font-bold">Listes</h2>
          {#if rel?.isSelf && lists.length > 0}
            <a
              href="/lists"
              class="text-dim hover:text-accent flex items-center gap-1 text-sm font-semibold md:hidden">
              Gérer
              <Icon name="chevron-right" class="h-4 w-4" />
            </a>
          {/if}
        </div>
        <div class="flex items-stretch gap-4">
          {#if rel?.isSelf && lists.length > 0}
            <a href="/lists" class="mt-2 hidden w-28 shrink-0 sm:w-32 md:block">
              <div
                class="card hover:border-accent text-dim hover:text-accent flex aspect-2/3 flex-col items-center justify-center gap-1.5 transition-colors">
                <Icon name="list" class="h-6 w-6" />
                <span class="text-xs font-semibold">Tout voir</span>
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
                    class="w-28 shrink-0 snap-start self-start sm:w-32">
                    <div
                      class="card text-dim hover:border-accent hover:text-accent flex aspect-2/3 flex-col items-center justify-center gap-1.5 border-dashed transition-colors">
                      <Icon name="plus" class="h-6 w-6" />
                      <span class="text-xs font-semibold">Créer</span>
                    </div>
                  </button>
                {:else}
                  <a
                    href="/lists/{item.list.id}"
                    class="w-28 shrink-0 snap-start sm:w-32">
                    <div
                      class="card hover:border-accent overflow-hidden transition-colors">
                      <ListCoverGrid
                        images={item.list.previewImageUrls}
                        title={item.list.title} />
                    </div>
                    <p class="mt-1.5 truncate text-xs font-semibold">
                      {item.list.title}
                    </p>
                  </a>
                {/if}
              {/snippet}
            </Carousel>
          </div>
        </div>
      </section>
    {/if}

    {#if rel?.isSelf}
      <ProfileReviews />
    {/if}

    <!-- Recent activity (visibility-filtered server-side; self-hides if empty). -->
    <ProfileActivity username={profile.username} />
  {/if}
</div>

{#if connectionsKind}
  <Modal
    title={connectionsKind === "followers" ? "Abonnés" : "Abonnements"}
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
          ? "Personne ne suit ce profil pour l'instant."
          : "Ce profil ne suit personne pour l'instant."}
      </p>
    {:else}
      <ul class="max-h-96 space-y-1 overflow-y-auto">
        {#each connections as u (u.id)}
          <li>
            <a
              href={`/u/${u.username}`}
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
    title="Bloquer {profile.displayName}"
    message="{profile.displayName} ne pourra plus vous suivre ni voir votre contenu, et vous ne verrez plus le sien. Vous pourrez débloquer à tout moment."
    confirmLabel="Bloquer"
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
