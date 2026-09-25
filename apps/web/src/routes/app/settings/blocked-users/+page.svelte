<script lang="ts">
  import { getBlockedUsers, unblockUser } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { keys } from "$lib/api/keys";
  import Avatar from "$lib/components/Avatar.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { PagedResult, UserSummaryDto } from "@loomkeep/shared";
  import SettingsSection from "../components/SettingsSection.svelte";

  const blockedQuery = createApiInfiniteQuery<
    PagedResult<UserSummaryDto>,
    number,
    UserSummaryDto
  >(() => ({
    key: keys.social.blockedUsers(),
    fetch: getBlockedUsers,
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
  }));
  const blockedUsers = $derived(blockedQuery.data);

  const unblockMutation = createApiMutation<string, unknown>(() => ({
    mutate: unblockUser,
    invalidates: [keys.social.blockedUsers()],
  }));
</script>

<SettingsSection slug="blocked-users">
  {#if blockedQuery.loading}
    <CardRowSkeleton count={3} />
  {:else if blockedQuery.error}
    <Banner variant="error">{blockedQuery.error}</Banner>
  {:else if blockedUsers.length === 0}
    <EmptyState class="px-5 py-10">
      <Icon name="users" class="text-accent mx-auto h-6 w-6" />
      <p class="mt-3 font-semibold">{m.settings_blocked_users_empty_title()}</p>
      <p class="text-dim mt-1 text-sm">
        {m.settings_blocked_users_empty_body()}
      </p>
    </EmptyState>
  {:else}
    <ul class="flex flex-col gap-2.5">
      {#each blockedUsers as user (user.id)}
        <li class="card flex items-center gap-3 p-4">
          <Avatar seed={user.username} url={user.avatarUrl} size={40} />
          <a
            href="/app/u/{user.username}"
            class="min-w-0 flex-1 rounded-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
            <span class="block truncate font-semibold">{user.displayName}</span>
            <span class="text-dim block truncate text-sm"
              >@{user.username}</span>
          </a>
          <button
            class="btn btn-ghost shrink-0"
            disabled={unblockMutation.loading}
            onclick={() => unblockMutation.mutate(user.username)}>
            {m.common_unblock()}
          </button>
        </li>
      {/each}
    </ul>

    {#if unblockMutation.error}
      <Banner variant="error" class="mt-4">{unblockMutation.error}</Banner>
    {/if}

    {#if blockedQuery.hasNextPage}
      <div class="mt-5 flex justify-center">
        <button
          class="btn btn-ghost"
          disabled={blockedQuery.isFetchingNextPage}
          onclick={() => blockedQuery.fetchNextPage()}>
          {blockedQuery.isFetchingNextPage
            ? m.common_loading()
            : m.common_see_more()}
        </button>
      </div>
    {/if}
  {/if}
</SettingsSection>
