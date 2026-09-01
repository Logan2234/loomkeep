<script lang="ts">
  import {
    addListMember,
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

  // Owner-only: add/remove editors (ListMember) by username. Editors can add,
  // remove and reorder items and edit title/description, but never delete the
  // list, change its visibility, or manage members themselves.
  let { listId, onClose }: { listId: string; onClose: () => void } = $props();

  let username = $state("");

  const membersQuery = createApiQuery(() => ({
    key: keys.lists.members(listId),
    fetch: () => getListMembers(listId),
  }));
  const members = $derived(membersQuery.data ?? []);
  const loading = $derived(membersQuery.loading);

  const addMut = createApiMutation(() => ({
    mutate: (value: string) => addListMember(listId, { username: value }),
    coveredFields: ["username"],
    invalidates: [keys.lists.members(listId)],
    onSuccess: () => (username = ""),
  }));

  function add() {
    const value = username.trim();
    if (!value || addMut.loading) return;
    addMut.mutate(value);
  }

  const removeMut = createApiMutation(() => ({
    mutate: (userId: string) => removeListMember(listId, userId),
    invalidates: [keys.lists.members(listId)],
  }));

  function remove(userId: string) {
    if (removeMut.loading) return;
    removeMut.mutate(userId);
  }

  const busy = $derived(addMut.loading || removeMut.loading);
  const error = $derived(addMut.error);
</script>

<Modal title={m.list_members_title()} onclose={onClose}>
  <div class="space-y-4">
    <p class="text-dim text-sm">{m.list_members_description()}</p>

    <div class="flex gap-2">
      <input
        type="text"
        name="username"
        class="input flex-1"
        minlength="1"
        required
        enterkeyhint="done"
        placeholder={m.common_username()}
        bind:value={username}
        onkeydown={(e) => e.key === "Enter" && add()} />
      <button
        class="btn btn-primary shrink-0"
        disabled={busy || !username.trim()}
        onclick={add}>
        {m.common_add()}
      </button>
    </div>

    {#if error}
      <p class="text-danger text-sm">{error}</p>
    {/if}

    {#if loading}
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
              onclick={() => remove(member.user.id)}>
              <Icon name="trash" class="h-4 w-4" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</Modal>
