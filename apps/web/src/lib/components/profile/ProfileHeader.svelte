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
    onToggleFollow,
    onUnfriend,
    onToggleBlock,
    onReport,
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
    onToggleFollow: () => void;
    /** Unfollowing a friend, from the menu: it ends the friendship. */
    onUnfriend: () => void;
    onToggleBlock: () => void;
    onReport: () => void;
    onOpenAvatarZoom: () => void;
    onOpenAvatarModal: () => void;
    onOpenEditProfile: () => void;
    onOpenShareModal: () => void;
    onOpenScanModal: () => void;
    onOpenConnections: (kind: "followers" | "following") => void;
  } = $props();

  const queryClient = useQueryClient();

  // Unfollowing is rarer than following: once followed, it moves from the
  // header to the menu — and ends a friendship when they follow back.
  const mutualFriends = $derived(
    !!rel && !rel.isSelf && rel.following && rel.followsYou,
  );

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

{#snippet counter(value: number, label: string, onclick?: () => void)}
  {#if onclick}
    <button
      type="button"
      class="hover:bg-surface-2 rounded-lg px-1.5 py-1 transition-colors"
      {onclick}>
      <CountFlash
        {value}
        class="font-display text-fg text-base font-extrabold tabular-nums" />
      {label}
    </button>
  {:else}
    <span class="px-1.5 py-1">
      <CountFlash
        {value}
        class="font-display text-fg text-base font-extrabold tabular-nums" />
      {label}
    </span>
  {/if}
{/snippet}

<section class="card relative flex flex-col p-5 md:p-6">
  <span
    aria-hidden="true"
    class="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full opacity-[0.06] dark:opacity-[0.12]"
    style="background: radial-gradient(circle, var(--accent), transparent 70%)">
  </span>

  <div
    class="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-4">
        <div class="relative shrink-0">
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
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1
              class="font-display text-[26px] leading-tight font-extrabold wrap-anywhere md:text-[34px]">
              {profile.displayName}
            </h1>
            {#if appConfig.gamificationEnabled}
              <StreakBadge
                days={profile.activityStats.streakDays}
                securedToday={profile.activityStats.streakSecuredToday}
                isSelf={!!rel?.isSelf}
                trackKey={rel?.isSelf && auth.user
                  ? `streak:${auth.user.id}`
                  : undefined} />
            {/if}
            {#if !selfManage && rel?.isFriend}
              <span class="chip chip-on py-1! text-xs"
                >{m.common_friends()}</span>
            {:else if !selfManage && rel?.followsYou}
              <span class="chip py-1! text-xs">{m.profile_follows_you()}</span>
            {/if}
          </div>
          <p
            class="text-dim mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
            <span class="timecode">@{profile.username}</span>
          </p>
          {#if selfManage && auth.user}
            <p class="text-dim truncate text-sm">{auth.user.email}</p>
          {/if}
        </div>
      </div>

      {#if profile.bio}
        <p class="mt-3 max-w-[62ch] text-sm leading-relaxed">
          {profile.bio}
        </p>
      {/if}

      <div class="text-dim -mx-1.5 mt-3 flex flex-wrap text-sm">
        {@render counter(
          profile.followerCount,
          profile.followerCount > 1
            ? m.profile_followers_plural()
            : m.profile_followers_singular(),
          () => onOpenConnections("followers"),
        )}
        {@render counter(
          profile.followingCount,
          profile.followingCount > 1
            ? m.profile_following_plural()
            : m.profile_following_singular(),
          () => onOpenConnections("following"),
        )}
        {@render counter(
          profile.reviewsCount,
          profile.reviewsCount > 1
            ? m.profile_reviews_count_plural()
            : m.profile_reviews_count_singular(),
          rel?.isSelf ? () => goto("/app/reviews") : undefined,
        )}
        {@render counter(
          profile.listsCount,
          profile.listsCount > 1
            ? m.profile_lists_count_plural()
            : m.profile_lists_count_singular(),
          rel?.isSelf ? () => goto("/app/lists") : undefined,
        )}
      </div>

      {#if selfManage}
        <div class="mt-4 flex gap-2">
          <button
            type="button"
            class="btn btn-ghost flex-1 sm:flex-none"
            onclick={onOpenEditProfile}>
            <Icon name="edit" class="h-4 w-4" />
            {m.common_edit()}
          </button>
          <button
            type="button"
            class="btn btn-ghost flex-1 sm:flex-none"
            onclick={onOpenShareModal}>
            <Icon name="share" class="h-4 w-4" />
            {m.common_share()}
          </button>
          <button
            type="button"
            class="btn-icon-bordered self-center sm:hidden"
            title={m.scan_profile_title()}
            aria-label={m.scan_profile_title()}
            onclick={onOpenScanModal}>
            <Icon name="camera" class="h-4 w-4" />
          </button>
          <a
            href="/app/settings"
            class="btn-icon-bordered self-center"
            title={m.common_settings()}
            aria-label={m.common_settings()}>
            <Icon name="gear" class="h-4 w-4" />
          </a>
        </div>
      {/if}
    </div>

    {#if rel && !rel.isSelf}
      <div class="flex shrink-0 flex-wrap gap-2 md:justify-end">
        {#if rel.blocking}
          <button class="btn btn-ghost" disabled={busy} onclick={onToggleBlock}>
            {m.common_unblock()}
          </button>
        {:else}
          {#if !ghostCantFollow && !rel.following}
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
            {#if rel?.following && !rel.blocking}
              <button
                role="menuitem"
                class="menu-item"
                disabled={busy}
                onclick={() => {
                  close();
                  if (mutualFriends) onUnfriend();
                  else onToggleFollow();
                }}>
                <Icon name="user-minus" class="h-4 w-4" />
                {mutualFriends ? m.profile_unfriend() : m.common_unfollow()}
              </button>
            {/if}
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
    {/if}
  </div>
</section>
