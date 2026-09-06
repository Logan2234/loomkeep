<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import BadgeShowcase from "$lib/components/BadgeShowcase.svelte";
  import CountFlash from "$lib/components/CountFlash.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import LevelBadge from "$lib/components/LevelBadge.svelte";
  import LevelCard from "$lib/components/LevelCard.svelte";
  import StreakBadge from "$lib/components/StreakBadge.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
  import type { RelationshipDto, SocialProfileDto } from "@loomkeep/shared";

  let {
    profile,
    rel,
    selfManage,
    publicView,
    busy,
    followLabel,
    ghostCantFollow,
    memberSince,
    onToggleFollow,
    onToggleBlock,
    onSignOut,
    onOpenAvatarZoom,
    onOpenAvatarModal,
    onOpenEditProfile,
    onOpenShareModal,
    onOpenScanModal,
    onOpenConnections,
  }: {
    profile: SocialProfileDto;
    rel: RelationshipDto | null;
    selfManage: boolean | undefined;
    publicView: boolean;
    busy: boolean;
    followLabel: string;
    ghostCantFollow: boolean;
    memberSince: string;
    onToggleFollow: () => void;
    onToggleBlock: () => void;
    onSignOut: () => void;
    onOpenAvatarZoom: () => void;
    onOpenAvatarModal: () => void;
    onOpenEditProfile: () => void;
    onOpenShareModal: () => void;
    onOpenScanModal: () => void;
    onOpenConnections: (kind: "followers" | "following") => void;
  } = $props();
</script>

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
        onclick={onOpenAvatarZoom}>
        <Avatar seed={profile.username} url={profile.avatarUrl} size={80} />
      </button>
      {#if selfManage}
        <button
          type="button"
          class="bg-accent text-accent-fg border-surface absolute -right-1 -bottom-1 grid h-7 w-7 place-items-center rounded-full border-2"
          aria-label={m.profile_avatar_change()}
          onclick={onOpenAvatarModal}>
          <Icon name="camera" class="h-3.5 w-3.5" />
        </button>
      {/if}
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h1 class="font-display truncate text-2xl font-extrabold md:text-3xl">
          {profile.displayName}
        </h1>
        <StreakBadge
          days={profile.activityStats.visible
            ? profile.activityStats.streakDays
            : undefined}
          trackKey={rel?.isSelf && auth.user
            ? `streak:${auth.user.id}`
            : undefined} />
        {#if appConfig.gamificationEnabled}
          <LevelBadge xp={profile.xp} />
        {/if}
        {#if selfManage}
          <button
            type="button"
            class="text-dim hover:text-fg hover:bg-surface-2 rounded-full p-1"
            aria-label={m.profile_edit()}
            onclick={onOpenEditProfile}>
            <Icon name="edit" class="h-3.5 w-3.5" />
          </button>
        {:else if rel?.isFriend}
          <span class="chip chip-on py-1! text-xs">{m.common_friends()}</span>
        {:else if rel?.followsYou}
          <span class="chip py-1! text-xs">{m.profile_follows_you()}</span>
        {/if}
      </div>
      <p class="text-dim mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
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
          onclick={() => onOpenConnections("followers")}>
          <CountFlash
            value={profile.followerCount}
            class="timecode text-fg text-lg font-bold" />
          <span class="text-dim ml-1 text-xs tracking-wide uppercase"
            >{profile.followerCount > 1
              ? m.profile_followers_plural()
              : m.profile_followers_singular()}</span>
        </button>
        <button
          type="button"
          class="hover:text-fg"
          onclick={() => onOpenConnections("following")}>
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
      <LevelCard
        xp={profile.xp}
        leaderboardHref={selfManage && appConfig.socialEnabled
          ? "/app/leaderboard"
          : undefined} />
    </div>
    <!-- [G9] Same gate as xp above (equippedBadges is empty whenever xp
         would have been null) — renders nothing at all when the viewer
         has nothing equipped, per the ticket's zero-footprint rule. -->
    <div class="mt-3">
      <BadgeShowcase badges={profile.equippedBadges} />
    </div>
  {/if}

  {#if rel && !rel.isSelf}
    <!-- Top-right of the card from `sm` up, positioned absolutely: these
         buttons used to sit in the header row and squeezed the info
         column badly enough to wrap the follower figures onto separate
         lines. Taking them out of the flow is what lets them live in the
         corner without competing for that width again. Below `sm` they
         stay a row under the block, where there is no corner to spare. -->
    <div
      class="border-border mt-5 flex flex-wrap gap-2 border-t pt-5 sm:absolute sm:top-5 sm:right-5 sm:mt-0 sm:border-t-0 sm:pt-0 md:top-6 md:right-6">
      {#if rel.blocking}
        <button class="btn btn-ghost" disabled={busy} onclick={onToggleBlock}>
          {m.common_unblock()}
        </button>
      {:else}
        {#if !ghostCantFollow}
          <button
            class="btn {rel.following || rel.requested
              ? 'btn-ghost'
              : 'btn-primary'}"
            disabled={busy}
            onclick={onToggleFollow}>
            {followLabel}
          </button>
        {/if}
        <button
          class="btn btn-ghost"
          disabled={busy}
          title={m.common_block()}
          aria-label={m.common_block()}
          onclick={onToggleBlock}>
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
          class="btn-icon-bordered relative"
          title={m.gamification_my_achievements()}
          aria-label={m.gamification_my_achievements()}>
          <Icon name="trophy" class="h-4 w-4" />
          {#if isFeatureNew("achievements")}
            <!-- A dot, not the full "Nouveau" pill: the pill is sized for
                 a labelled row and swamps a 36px round button. -->
            <span
              class="bg-accent border-surface absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
              aria-hidden="true">
            </span>
          {/if}
        </a>
      {/if}
      <button
        type="button"
        class="btn-icon-bordered"
        title={m.share_profile_title()}
        aria-label={m.share_profile_title()}
        onclick={onOpenShareModal}>
        <Icon name="share" class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="btn-icon-bordered sm:hidden"
        title={m.scan_profile_title()}
        aria-label={m.scan_profile_title()}
        onclick={onOpenScanModal}>
        <Icon name="camera" class="h-4 w-4" />
      </button>
      <a
        href="/app/settings"
        class="btn-icon-bordered"
        title={m.common_settings()}
        aria-label={m.common_settings()}>
        <Icon name="gear" class="h-4 w-4" />
      </a>
      <button
        type="button"
        class="border-danger/40 text-danger hover:bg-danger/10 grid h-9 w-9 place-items-center rounded-full border"
        title={m.common_logout()}
        aria-label={m.common_logout()}
        onclick={onSignOut}>
        <Icon name="logout" class="h-4 w-4" />
      </button>
    </div>
  {/if}
</section>
