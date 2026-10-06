<script lang="ts">
  import {
    addListMember,
    getListMemberCandidates,
    getListMembers,
    removeListMember,
  } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { DATE_MEDIUM_OPTIONS, formatDate } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { UserSummaryDto } from "@loomkeep/shared";
  import { flip } from "svelte/animate";
  import { fly, scale, slide } from "svelte/transition";
  import Avatar from "./Avatar.svelte";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";

  // Owner-only: add/remove editors (ListMember), picked among the owner's
  // friends — only friends may edit a list. Editors can add, remove and
  // reorder items and edit title/description, but never delete the list,
  // change its visibility, or manage members themselves.
  let {
    listId,
    owner,
    onClose,
  }: { listId: string; owner: UserSummaryDto; onClose: () => void } = $props();

  type Tab = "team" | "invite";

  const reduced = prefersReducedMotion();

  let tab = $state<Tab>("team");
  let search = $state("");
  let confirmingRemove = $state<string | null>(null);

  const membersQuery = createApiQuery(() => ({
    key: keys.lists.members(listId),
    fetch: () => getListMembers(listId),
  }));
  const members = $derived(membersQuery.data ?? []);
  const memberIds = $derived(new Set(members.map((member) => member.user.id)));

  const candidatesQuery = createApiQuery(() => ({
    key: keys.lists.memberCandidates(listId),
    fetch: () => getListMemberCandidates(listId),
  }));

  // Members stay in the invite list, marked as added: adding one doesn't
  // make the row vanish under the cursor.
  const friends = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return [
      ...(candidatesQuery.data ?? []),
      ...members.map((member) => member.user),
    ]
      .filter(
        (friend) =>
          !q ||
          friend.displayName.toLowerCase().includes(q) ||
          friend.username.toLowerCase().includes(q),
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
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
    onSuccess: () => (confirmingRemove = null),
  }));

  const busy = $derived(addMut.loading || removeMut.loading);
  const error = $derived(addMut.error ?? removeMut.error);

  const options = $derived([
    {
      value: "team" as const,
      label: `${m.list_members_team()} · ${members.length + 1}`,
    },
    { value: "invite" as const, label: m.list_members_add_friend() },
  ]);

  function switchTo(next: Tab) {
    tab = next;
    confirmingRemove = null;
  }
</script>

<Modal title={m.list_members_title()} onclose={onClose}>
  <div class="flex flex-col gap-4">
    <SegmentedControl
      class="w-full [&>*]:flex-1 [&>*]:justify-center"
      label={m.list_members_title()}
      {options}
      value={tab}
      onChange={switchTo} />

    {#if error}
      <p class="text-danger text-sm">{error}</p>
    {/if}

    {#key tab}
      <div
        class="min-h-48"
        in:fly={{
          x: reduced ? 0 : tab === "invite" ? 24 : -24,
          duration: reduced ? 0 : 220,
        }}>
        {#if tab === "team"}
          <ul class="flex flex-col gap-2">
            <li
              class="border-border flex items-center gap-3 rounded-xl border p-3">
              <Avatar seed={owner.username} url={owner.avatarUrl} size={36} />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold"
                  >{owner.displayName}</span>
                <span class="timecode text-xs">{m.list_members_owner()}</span>
              </span>
            </li>
            {#if membersQuery.loading}
              <li class="skeleton h-16 w-full rounded-xl"></li>
            {/if}
            {#each members as member (member.user.id)}
              <li
                class="border-border overflow-hidden rounded-xl border"
                animate:flip={{ duration: reduced ? 0 : 220 }}
                out:slide={{ duration: reduced ? 0 : 200 }}>
                <div class="flex items-center gap-3 p-3">
                  <a
                    href="/app/u/{member.user.username}"
                    class="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar
                      seed={member.user.username}
                      url={member.user.avatarUrl}
                      size={36} />
                    <span class="min-w-0">
                      <span class="block truncate font-semibold">
                        {member.user.displayName}
                      </span>
                      <span class="timecode block truncate text-xs">
                        {m.list_members_since({
                          date: formatDate(
                            member.createdAt,
                            DATE_MEDIUM_OPTIONS,
                          ),
                        })}
                      </span>
                    </span>
                  </a>
                  <button
                    type="button"
                    class="btn-icon hover:text-danger hover:bg-danger/10 h-9 w-9"
                    aria-label={m.common_remove()}
                    title={m.common_remove()}
                    aria-expanded={confirmingRemove === member.user.id}
                    onclick={() =>
                      (confirmingRemove =
                        confirmingRemove === member.user.id
                          ? null
                          : member.user.id)}>
                    <Icon name="trash" class="h-4 w-4" />
                  </button>
                </div>
                {#if confirmingRemove === member.user.id}
                  <div
                    class="bg-danger/8 flex flex-wrap items-center gap-2 px-3 py-2"
                    transition:slide={{ duration: reduced ? 0 : 180 }}>
                    <p class="min-w-40 flex-1 text-xs">
                      {m.list_members_remove_confirm({
                        name: member.user.displayName,
                      })}
                    </p>
                    <button
                      type="button"
                      class="btn-text"
                      onclick={() => (confirmingRemove = null)}>
                      {m.common_cancel()}
                    </button>
                    <button
                      type="button"
                      class="btn btn-danger btn-sm"
                      disabled={busy}
                      onclick={() => removeMut.mutate(member.user.id)}>
                      {m.common_remove()}
                    </button>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
          {#if !membersQuery.loading && members.length === 0}
            <p class="text-dim mt-3 text-sm">{m.list_members_empty()}</p>
          {/if}
          <p
            class="text-dim border-border/60 mt-4 flex gap-2 border-t pt-3 text-xs">
            <Icon name="info" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {m.list_members_description()}
          </p>
        {:else}
          <div class="relative">
            <Icon
              name="search"
              class="text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              class="input pl-9"
              enterkeyhint="search"
              aria-label={m.list_members_search()}
              placeholder={m.list_members_search()}
              bind:value={search} />
          </div>

          {#if candidatesQuery.loading}
            <div class="skeleton mt-3 h-12 w-full rounded-lg"></div>
          {:else if friends.length === 0}
            <p class="text-dim mt-3 text-sm">
              {search.trim()
                ? m.list_members_no_match()
                : m.list_members_no_friends()}
            </p>
          {:else}
            <ul class="mt-2 flex flex-col">
              {#each friends as friend (friend.id)}
                {@const added = memberIds.has(friend.id)}
                <li
                  class="flex items-center gap-3 rounded-lg px-1 py-2"
                  animate:flip={{ duration: reduced ? 0 : 220 }}>
                  <Avatar
                    seed={friend.username}
                    url={friend.avatarUrl}
                    size={32} />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-semibold">
                      {friend.displayName}
                    </span>
                    <span class="timecode block truncate text-xs">
                      @{friend.username}
                    </span>
                  </span>
                  {#if added}
                    <span
                      class="text-success inline-flex shrink-0 items-center gap-1 text-xs font-semibold"
                      in:scale={{ start: 0.6, duration: reduced ? 0 : 220 }}>
                      <Icon name="check" class="h-3.5 w-3.5" />
                      {m.list_members_added()}
                    </span>
                  {:else}
                    <button
                      class="btn btn-ghost btn-sm shrink-0"
                      disabled={busy}
                      onclick={() => addMut.mutate(friend.username)}>
                      <Icon name="plus" class="h-3.5 w-3.5" />
                      {m.common_add()}
                    </button>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </div>
    {/key}
  </div>
</Modal>
