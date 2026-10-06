<script lang="ts">
  import { goto } from "$app/navigation";
  import { openConversation } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import CountFlash from "#lib/components/CountFlash.svelte";
  import Dropdown from "#lib/components/Dropdown.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import StreakBadge from "#lib/components/StreakBadge.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { RelationshipDto, SocialProfileDto } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";

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
    onReport,
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
    onReport: () => void;
    onSignOut: () => void;
    onOpenAvatarZoom: () => void;
    onOpenAvatarModal: () => void;
    onOpenEditProfile: () => void;
    onOpenShareModal: () => void;
    onOpenScanModal: () => void;
    onOpenConnections: (kind: "followers" | "following") => void;
  } = $props();

  const queryClient = useQueryClient();

  // Messages go between accounts that follow each other.
  const canMessage = $derived(
    appConfig.chatEnabled &&
      !!rel &&
      !rel.isSelf &&
      !rel.blocking &&
      rel.following &&
      rel.followsYou &&
      profile.profileAccess !== "GHOST",
  );

  const messageMut = createApiMutation(() => ({
    mutate: () => openConversation(profile.username),
    onSuccess: (conversation) => {
      queryClient.setQueryData(
        keys.chat.conversation(conversation.id),
        conversation,
      );
      chat.show(conversation.id);
    },
    errorToast: true,
  }));
</script>

<section class="card relative flex flex-col p-5 md:p-6">
  <span
    aria-hidden="true"
    class="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full opacity-[0.06] dark:opacity-[0.12]"
    style="background: radial-gradient(circle, var(--accent), transparent 70%)">
  </span>

  <div
    class="relative mb-5 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
    <div class="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
      <div class="relative shrink-0 self-start">
        <button
          type="button"
          class="cursor-zoom-in"
          aria-label={m.profile_avatar_zoom()}
          onclick={onOpenAvatarZoom}>
          <Avatar seed={profile.username} url={profile.avatarUrl} size={88} />
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
          <h1
            class="font-display truncate text-[26px] font-extrabold md:text-[34px]">
            {profile.displayName}
          </h1>
          {#if appConfig.gamificationEnabled}
            <StreakBadge
              days={profile.activityStats.visible
                ? profile.activityStats.streakDays
                : undefined}
              securedToday={profile.activityStats.visible
                ? profile.activityStats.streakSecuredToday
                : undefined}
              isSelf={!!rel?.isSelf}
              trackKey={rel?.isSelf && auth.user
                ? `streak:${auth.user.id}`
                : undefined} />
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
          <p class="mt-3 max-w-[62ch] text-sm leading-relaxed">
            {profile.bio}
          </p>
        {/if}
      </div>
    </div>

    {#if rel && !rel.isSelf}
      <div class="flex shrink-0 flex-wrap gap-2 md:justify-end">
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
        {/if}
        {#if canMessage}
          <button
            type="button"
            class="btn btn-ghost px-3"
            aria-label={m.chat_write_to({ name: profile.displayName })}
            title={m.chat_write_to({ name: profile.displayName })}
            disabled={messageMut.loading}
            onclick={() => messageMut.mutate()}>
            <Icon name="message" class="h-4 w-4" />
          </button>
        {/if}
        <Dropdown placement="bottom-end" role="menu" class="min-w-44">
          {#snippet trigger({ open, toggle, onkeydown })}
            <button
              type="button"
              class="btn btn-ghost px-3"
              aria-label={m.common_more_actions()}
              title={m.common_more_actions()}
              aria-haspopup="menu"
              aria-expanded={open}
              {onkeydown}
              onclick={toggle}>
              <Icon name="dots-horizontal" class="h-4 w-4" />
            </button>
          {/snippet}
          {#snippet children({ close })}
            {#if !rel?.blocking}
              <button
                role="menuitem"
                class="menu-item"
                disabled={busy}
                onclick={() => {
                  close();
                  onToggleBlock();
                }}>
                <Icon name="eye-off" class="h-4 w-4" />
                {m.common_block()}
              </button>
            {/if}
            <button
              role="menuitem"
              class="menu-item menu-item-danger"
              onclick={() => {
                close();
                onReport();
              }}>
              <Icon name="flag" class="h-4 w-4" />
              {m.common_report()}
            </button>
          {/snippet}
        </Dropdown>
      </div>
    {:else if rel?.isSelf && publicView}
      <a
        href="/app/profile"
        class="border-border text-dim hover:bg-surface-2 hover:text-fg flex shrink-0 items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs font-bold">
        <Icon name="chevron-left" class="h-3.5 w-3.5" />
        {m.profile_back_to_own()}
      </a>
    {:else if selfManage}
      <div class="flex shrink-0 flex-wrap gap-1.5 md:justify-end">
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
  </div>

  <div
    class="relative -mx-5 mt-auto -mb-5 grid grid-cols-6 text-center sm:grid-cols-5 md:-mx-6 md:-mb-6">
    <button
      type="button"
      class="border-border hover:bg-surface-2 col-span-3 border-y py-3 text-center transition-colors sm:col-span-1 sm:border-b-0"
      onclick={() => onOpenConnections("followers")}>
      <CountFlash
        value={profile.followerCount}
        class="font-display block text-lg font-extrabold tabular-nums" />
      <span
        class="text-dim mt-0.5 block font-mono text-[10px] tracking-[0.13em] uppercase">
        {profile.followerCount > 1
          ? m.profile_followers_plural()
          : m.profile_followers_singular()}
      </span>
    </button>
    <button
      type="button"
      class="border-border hover:bg-surface-2 col-span-3 border-y border-l py-3 text-center transition-colors sm:col-span-1 sm:border-b-0"
      onclick={() => onOpenConnections("following")}>
      <span class="font-display block text-lg font-extrabold tabular-nums"
        >{profile.followingCount}</span>
      <span
        class="text-dim mt-0.5 block font-mono text-[10px] tracking-[0.13em] uppercase">
        {profile.followingCount > 1
          ? m.profile_following_plural()
          : m.profile_following_singular()}
      </span>
    </button>
    {#if rel?.isSelf}
      <button
        type="button"
        class="border-border hover:bg-surface-2 col-span-2 py-3 text-center transition-colors sm:col-span-1 sm:border-t sm:border-l"
        onclick={() => goto("/app/reviews")}>
        <span class="font-display block text-lg font-extrabold tabular-nums"
          >{profile.reviewsCount}</span>
        <span
          class="text-dim mt-0.5 block font-mono text-[10px] tracking-[0.13em] uppercase">
          {profile.reviewsCount > 1
            ? m.profile_reviews_count_plural()
            : m.profile_reviews_count_singular()}
        </span>
      </button>
      <button
        type="button"
        class="border-border hover:bg-surface-2 pointer-events-none col-span-2 border-x py-3 text-center transition-colors sm:col-span-1 sm:border-t"
        onclick={() => goto("/app/comments")}>
        <span class="font-display block text-lg font-extrabold tabular-nums"
          >{profile.commentsCount}</span>
        <span
          class="text-dim mt-0.5 block font-mono text-[10px] tracking-[0.13em] uppercase">
          {m.profile_comments_count()}
        </span>
      </button>
      <button
        type="button"
        class="border-border hover:bg-surface-2 col-span-2 py-3 text-center transition-colors sm:col-span-1 sm:border-t"
        onclick={() => goto("/app/lists")}>
        <span class="font-display block text-lg font-extrabold tabular-nums"
          >{profile.listsCount}</span>
        <span
          class="text-dim mt-0.5 block font-mono text-[10px] tracking-[0.13em] uppercase">
          {profile.listsCount > 1
            ? m.profile_lists_count_plural()
            : m.profile_lists_count_singular()}
        </span>
      </button>
    {:else}
      <div
        class="border-border col-span-2 py-3 sm:col-span-1 sm:border-t sm:border-l">
        <span class="font-display block text-lg font-extrabold tabular-nums"
          >{profile.reviewsCount}</span>
        <span
          class="text-dim mt-0.5 block font-mono text-[10px] tracking-[0.13em] uppercase">
          {profile.reviewsCount > 1
            ? m.profile_reviews_count_plural()
            : m.profile_reviews_count_singular()}
        </span>
      </div>
      <div
        class="border-border col-span-2 border-x py-3 sm:col-span-1 sm:border-t">
        <span class="font-display block text-lg font-extrabold tabular-nums"
          >{profile.commentsCount}</span>
        <span
          class="text-dim mt-0.5 block font-mono text-[10px] tracking-[0.13em] uppercase">
          {m.profile_comments_count()}
        </span>
      </div>
      <div class="border-border col-span-2 py-3 sm:col-span-1 sm:border-t">
        <span class="font-display block text-lg font-extrabold tabular-nums"
          >{profile.listsCount}</span>
        <span
          class="text-dim mt-0.5 block font-mono text-[10px] tracking-[0.13em] uppercase">
          {profile.listsCount > 1
            ? m.profile_lists_count_plural()
            : m.profile_lists_count_singular()}
        </span>
      </div>
    {/if}
  </div>
</section>
