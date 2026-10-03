<script lang="ts">
  import {
    followUser,
    getUserFollowers,
    getUserFollowing,
    removeFollower,
    unfollowUser,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { ConnectionDto, RelationshipDto } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { flip } from "svelte/animate";
  import { fly, slide } from "svelte/transition";

  type Kind = "followers" | "following";

  let {
    username,
    kind: initialKind,
    followerCount,
    followingCount,
    manage,
    onClose,
  }: {
    username: string;
    kind: Kind;
    followerCount: number;
    followingCount: number;
    /** The viewer's own profile: follow back, remove followers, unfollow. */
    manage: boolean;
    onClose: () => void;
  } = $props();

  const reduced = prefersReducedMotion();
  const queryClient = useQueryClient();

  let kind = $state<Kind>(initialKind);
  let direction = $state(1);
  let query = $state("");
  let confirmingRemove = $state<string | null>(null);

  const listKey = (which: Kind) => keys.profile.connections(username, which);

  const followersQuery = createApiQuery(() => ({
    key: listKey("followers"),
    fetch: () => getUserFollowers(username),
  }));
  const followingQuery = createApiQuery(() => ({
    key: listKey("following"),
    fetch: () => getUserFollowing(username),
  }));

  const activeQuery = $derived(
    kind === "followers" ? followersQuery : followingQuery,
  );
  const counts = $derived({
    followers: followersQuery.data?.length ?? followerCount,
    following: followingQuery.data?.length ?? followingCount,
  });

  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  const visible = $derived(
    (activeQuery.data ?? []).filter((user) =>
      normalize(`${user.displayName} ${user.username}`).includes(
        normalize(query),
      ),
    ),
  );

  const options = $derived([
    {
      value: "followers" as const,
      label: `${m.profile_connections_followers_title()} · ${counts.followers}`,
    },
    {
      value: "following" as const,
      label: `${m.profile_connections_following_title()} · ${counts.following}`,
    },
  ]);

  function switchTo(next: Kind) {
    direction = next === "following" ? 1 : -1;
    kind = next;
    confirmingRemove = null;
  }

  function patch(
    which: Kind,
    update: (list: ConnectionDto[]) => ConnectionDto[],
  ) {
    queryClient.setQueryData(
      listKey(which),
      (old: ConnectionDto[] | undefined) => (old ? update(old) : old),
    );
  }

  // The row keeps its place after a follow or an unfollow, so a mis-tap is
  // one tap away from being undone.
  function applyRelationship(id: string, relationship: RelationshipDto) {
    const update = (list: ConnectionDto[]) =>
      list.map((user) =>
        user.id === id
          ? {
              ...user,
              following: relationship.following,
              requested: relationship.requested,
              isFriend: relationship.isFriend,
            }
          : user,
      );
    patch("followers", update);
    patch("following", update);
  }

  const profileKey = $derived(keys.profile.detail(username));

  const followMut = createApiMutation(() => ({
    mutate: (user: ConnectionDto) =>
      user.following || user.requested
        ? unfollowUser(user.username)
        : followUser(user.username),
    onSuccess: (relationship, user) => applyRelationship(user.id, relationship),
    invalidates: [profileKey],
    errorToast: true,
  }));

  const removeMut = createApiMutation(() => ({
    mutate: (user: ConnectionDto) => removeFollower(user.username),
    onSuccess: (_relationship, user) => {
      confirmingRemove = null;
      patch("followers", (list) => list.filter((u) => u.id !== user.id));
    },
    invalidates: [profileKey],
    errorToast: true,
  }));

  const busyId = $derived(
    followMut.loading
      ? followMut.variables?.id
      : removeMut.loading
        ? removeMut.variables?.id
        : null,
  );
</script>

{#snippet actions(user: ConnectionDto)}
  {#if manage && user.id !== auth.user?.id}
    {#if kind === "followers"}
      {#if !user.following && !user.requested}
        <button
          type="button"
          class="btn btn-primary btn-sm"
          disabled={busyId === user.id}
          onclick={() => followMut.mutate(user)}>
          {m.profile_connections_follow_back()}
        </button>
      {:else if user.requested}
        <span class="timecode text-xs">{m.profile_follow_requested()}</span>
      {/if}
      <button
        type="button"
        class="btn-icon hover:text-danger hover:bg-danger/10"
        aria-label={m.profile_connections_remove({ name: user.displayName })}
        title={m.profile_connections_remove({ name: user.displayName })}
        aria-expanded={confirmingRemove === user.id}
        onclick={() =>
          (confirmingRemove = confirmingRemove === user.id ? null : user.id)}>
        <Icon name="x" class="h-4 w-4" />
      </button>
    {:else if user.following || user.requested}
      <button
        type="button"
        class="btn btn-ghost btn-sm hover:border-danger hover:text-danger"
        disabled={busyId === user.id}
        onclick={() => followMut.mutate(user)}>
        {user.requested
          ? m.profile_follow_cancel_request()
          : m.profile_connections_unfollow()}
      </button>
    {:else}
      <button
        type="button"
        class="btn btn-primary btn-sm"
        disabled={busyId === user.id}
        onclick={() => followMut.mutate(user)}>
        {m.common_follow()}
      </button>
    {/if}
  {/if}
{/snippet}

<Modal title={m.profile_connections_title()} onclose={onClose}>
  <div class="flex flex-col gap-3">
    <SegmentedControl
      class="w-full [&>*]:flex-1 [&>*]:justify-center"
      label={m.profile_connections_title()}
      {options}
      value={kind}
      onChange={switchTo} />

    <div class="relative">
      <Icon
        name="search"
        class="text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <input
        type="search"
        class="input pl-9"
        placeholder={m.profile_connections_search()}
        aria-label={m.profile_connections_search()}
        bind:value={query} />
    </div>

    {#key kind}
      <div
        class="min-h-40"
        in:fly={{
          x: reduced ? 0 : 24 * direction,
          duration: reduced ? 0 : 220,
        }}>
        {#if activeQuery.loading}
          <div class="space-y-3 pt-1">
            {#each { length: 4 } as _, i (i)}
              <div class="flex items-center gap-3">
                <div class="skeleton h-9 w-9 rounded-full"></div>
                <div class="skeleton h-4 w-32 rounded"></div>
              </div>
            {/each}
          </div>
        {:else if activeQuery.error}
          <p class="text-danger text-sm">{activeQuery.error}</p>
        {:else if (activeQuery.data ?? []).length === 0}
          <p class="text-dim text-sm">
            {kind === "followers"
              ? m.profile_connections_empty_followers()
              : m.profile_connections_empty_following()}
          </p>
        {:else if visible.length === 0}
          <p class="text-dim text-sm">
            {m.profile_connections_no_match({ query: query.trim() })}
          </p>
        {:else}
          <ul class="-mx-2 flex flex-col">
            {#each visible as user (user.id)}
              <li
                animate:flip={{ duration: reduced ? 0 : 220 }}
                out:slide={{ duration: reduced ? 0 : 200 }}>
                <div class="flex items-center gap-3 rounded-lg p-2">
                  <a
                    href="/app/u/{user.username}"
                    class="flex min-w-0 flex-1 items-center gap-3"
                    onclick={onClose}>
                    <Avatar
                      seed={user.username}
                      url={user.avatarUrl}
                      size={36} />
                    <span class="min-w-0">
                      <span class="flex items-center gap-1.5">
                        <span class="truncate text-sm font-semibold"
                          >{user.displayName}</span>
                        {#if user.isFriend}
                          <span
                            class="border-accent/45 bg-accent/10 text-accent shrink-0 rounded-full border px-1.5 text-[0.6rem] font-bold tracking-wide uppercase">
                            {m.profile_connections_friend()}
                          </span>
                        {/if}
                      </span>
                      <span class="timecode block truncate text-xs"
                        >@{user.username}</span>
                    </span>
                  </a>
                  <div class="flex shrink-0 items-center gap-1.5">
                    {@render actions(user)}
                  </div>
                </div>
                {#if confirmingRemove === user.id}
                  <div
                    class="bg-danger/8 mx-2 mb-2 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2"
                    transition:slide={{ duration: reduced ? 0 : 180 }}>
                    <p class="min-w-40 flex-1 text-xs">
                      {m.profile_connections_remove_confirm({
                        name: user.displayName,
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
                      disabled={busyId === user.id}
                      onclick={() => removeMut.mutate(user)}>
                      {m.common_remove()}
                    </button>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/key}
  </div>
</Modal>
