<script lang="ts">
  import {
    addListMember,
    getListMemberCandidates,
    getListMembers,
    removeListMember,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import Avatar from "./Avatar.svelte";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";

  // Owner-only: add/remove editors (ListMember), picked among the owner's
  // friends — only friends may edit a list. Editors can add, remove and
  // reorder items and edit title/description, but never delete the list,
  // change its visibility, or manage members themselves.
  let { listId, onClose }: { listId: string; onClose: () => void } = $props();

  let search = $state("");

  const membersQuery = createApiQuery(() => ({
    key: keys.lists.members(listId),
    fetch: () => getListMembers(listId),
  }));
  const members = $derived(membersQuery.data ?? []);

  const candidatesQuery = createApiQuery(() => ({
    key: keys.lists.memberCandidates(listId),
    fetch: () => getListMemberCandidates(listId),
  }));
  const candidates = $derived(candidatesQuery.data ?? []);
  const matchingCandidates = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (friend) =>
        friend.displayName.toLowerCase().includes(q) ||
        friend.username.toLowerCase().includes(q),
    );
  });

  // The list page underneath shows whether the list has editors (its mute
  // toggle and the per-item authors), so it refetches too.
  const touched = $derived([
    keys.lists.members(listId),
    keys.lists.memberCandidates(listId),
    keys.lists.detail(listId),
  ]);

  const addMut = createApiMutation(() => ({
    mutate: (username: string) => addListMember(listId, { username }),
    invalidates: touched,
  }));

  const removeMut = createApiMutation(() => ({
    mutate: (userId: string) => removeListMember(listId, userId),
    invalidates: touched,
  }));

  const busy = $derived(addMut.loading || removeMut.loading);
  const error = $derived(addMut.error ?? removeMut.error);
</script>

<Modal title={m.list_members_title()} onclose={onClose}>
  <div class="space-y-5">
    <p class="text-dim text-sm">{m.list_members_description()}</p>

    {#if error}
      <p class="text-danger text-sm">{error}</p>
    {/if}

    <section class="space-y-2">
      {#if membersQuery.loading}
        <div class="skeleton h-12 w-full rounded"></div>
      {:else if members.length === 0}
        <p class="text-dim text-sm">{m.list_members_empty()}</p>
      {:else}
        <ul class="space-y-2">
          {#each members as member (member.user.id)}
            <li class="flex items-center gap-3">
              <a
                href="/app/u/{member.user.username}"
                class="hover:text-fg flex min-w-0 flex-1 items-center gap-3">
                <Avatar
                  seed={member.user.username}
                  url={member.user.avatarUrl}
                  size={32} />
                <span class="min-w-0 flex-1 truncate font-semibold">
                  {member.user.displayName}
                </span>
              </a>
              <button
                class="text-dim hover:text-danger hover:bg-danger/10 grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors"
                aria-label={m.common_remove()}
                title={m.common_remove()}
                disabled={busy}
                onclick={() => removeMut.mutate(member.user.id)}>
                <Icon name="trash" class="h-4 w-4" />
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="border-border space-y-3 border-t pt-4">
      <h3 class="font-display text-sm font-bold">
        {m.list_members_add_friend()}
      </h3>

      {#if candidatesQuery.loading}
        <div class="skeleton h-12 w-full rounded"></div>
      {:else if candidates.length === 0}
        <p class="text-dim text-sm">{m.list_members_no_friends()}</p>
      {:else}
        <input
          type="search"
          class="input w-full"
          enterkeyhint="search"
          aria-label={m.list_members_search()}
          placeholder={m.list_members_search()}
          bind:value={search} />

        {#if matchingCandidates.length === 0}
          <p class="text-dim text-sm">{m.list_members_no_match()}</p>
        {:else}
          <ul class="max-h-72 space-y-2 overflow-y-auto">
            {#each matchingCandidates as friend (friend.id)}
              <li class="flex items-center gap-3">
                <Avatar
                  seed={friend.username}
                  url={friend.avatarUrl}
                  size={32} />
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-semibold">
                    {friend.displayName}
                  </span>
                  <span class="text-dim block truncate text-xs">
                    @{friend.username}
                  </span>
                </span>
                <button
                  class="btn btn-ghost shrink-0"
                  disabled={busy}
                  onclick={() => addMut.mutate(friend.username)}>
                  {m.common_add()}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </section>
  </div>
</Modal>
