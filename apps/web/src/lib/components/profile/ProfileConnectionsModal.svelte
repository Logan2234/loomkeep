<script lang="ts">
  import Avatar from "$lib/components/Avatar.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { UserSummaryDto } from "@loomkeep/shared";

  let {
    kind,
    connections,
    loading,
    onClose,
  }: {
    kind: "followers" | "following";
    connections: UserSummaryDto[];
    loading: boolean;
    onClose: () => void;
  } = $props();
</script>

<Modal
  title={kind === "followers"
    ? m.profile_connections_followers_title()
    : m.profile_connections_following_title()}
  onclose={onClose}>
  {#if loading}
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
      {kind === "followers"
        ? m.profile_connections_empty_followers()
        : m.profile_connections_empty_following()}
    </p>
  {:else}
    <ul class="max-h-96 space-y-1 overflow-y-auto">
      {#each connections as u (u.id)}
        <li>
          <a
            href={`/app/u/${u.username}`}
            class="hover:bg-surface-2 flex items-center gap-3 rounded-lg p-2"
            onclick={onClose}>
            <Avatar seed={u.username} url={u.avatarUrl} size={36} />
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold"
                >{u.displayName}</span>
              <span class="timecode block truncate text-xs">@{u.username}</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</Modal>
