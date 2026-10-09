<script lang="ts">
  // A row of friends to pick from, the ones written to last first — as on a
  // phone's share sheet. Shared by "Partager" and "Transférer".
  import { getChatFriends, getConversations } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { RECOMMEND_MAX_FRIENDS } from "@loomkeep/shared";
  import { scale } from "svelte/transition";

  let {
    picked = $bindable([]),
    label,
  }: {
    /** Usernames. */
    picked?: string[];
    label: string;
  } = $props();

  const reduced = prefersReducedMotion();

  const friendsQuery = createApiQuery(() => ({
    key: keys.chat.friends(""),
    fetch: () => getChatFriends(""),
  }));
  const conversationsQuery = createApiQuery(() => ({
    key: keys.chat.conversations(),
    fetch: () => getConversations(),
  }));

  const friends = $derived.by(() => {
    const recent = (conversationsQuery.data?.items ?? []).flatMap((c) =>
      c.peer ? [c.peer.id] : [],
    );
    const rank = (id: string) => {
      const index = recent.indexOf(id);
      return index === -1 ? recent.length : index;
    };
    return [...(friendsQuery.data ?? [])].sort(
      (a, b) => rank(a.id) - rank(b.id),
    );
  });

  function toggle(username: string) {
    picked = picked.includes(username)
      ? picked.filter((u) => u !== username)
      : picked.length < RECOMMEND_MAX_FRIENDS
        ? [...picked, username]
        : picked;
  }
</script>

<div
  role="group"
  aria-label={label}
  class="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
  {#each friends as friend (friend.id)}
    {@const selected = picked.includes(friend.username)}
    <button
      type="button"
      aria-pressed={selected}
      class="hover:bg-surface-2 flex w-16 shrink-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-xs font-semibold transition-colors duration-150"
      onclick={() => toggle(friend.username)}>
      <span
        class="relative rounded-full transition-shadow duration-150
          {selected
          ? 'ring-accent ring-offset-surface ring-2 ring-offset-2'
          : ''}">
        <Avatar seed={friend.username} url={friend.avatarUrl} size={44} />
        {#if selected}
          <span
            transition:scale={{ duration: reduced ? 0 : 150, start: 0.6 }}
            class="bg-accent text-accent-fg ring-surface absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full ring-2">
            <Icon name="check" class="h-3 w-3" />
          </span>
        {/if}
      </span>
      <span class="w-full truncate text-center">{friend.displayName}</span>
    </button>
  {:else}
    {#if !friendsQuery.loading}
      <p class="text-dim px-1 py-2 text-sm">{m.chat_no_friends()}</p>
    {/if}
  {/each}
</div>
