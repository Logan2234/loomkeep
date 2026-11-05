<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import type { GhostSwitchImpactDto } from "@loomkeep/shared";
  import Modal from "./Modal.svelte";

  // Becoming a Figurant applies at once (followers removed, lists made
  // private): shared by Settings › Privacy and the welcome tour so both show
  // the live counts before the switch.
  let {
    impact,
    loading,
    onconfirm,
    onclose,
  }: {
    impact: GhostSwitchImpactDto;
    loading: boolean;
    onconfirm: () => void;
    onclose: () => void;
  } = $props();
</script>

<Modal title={m.settings_privacy_ghost_title()} {onclose}>
  <p class="text-dim text-sm">
    {m.settings_privacy_ghost_description()}
  </p>
  <ul class="border-border divide-border mt-3 divide-y border-y text-sm">
    {#if impact.followersToRemove > 0}
      <li class="flex items-center justify-between gap-3 py-2">
        <span
          >{impact.followersToRemove > 1
            ? m.settings_privacy_removed_followers()
            : m.settings_privacy_removed_follower()}</span>
        <span class="timecode text-fg font-semibold"
          >{impact.followersToRemove}</span>
      </li>
    {/if}
    {#if impact.outgoingFollowsToCancel > 0}
      <li class="flex items-center justify-between gap-3 py-2">
        <span>{m.settings_privacy_cancelled_following()}</span>
        <span class="timecode text-fg font-semibold"
          >{impact.outgoingFollowsToCancel}</span>
      </li>
    {/if}
    {#if impact.listsToDowngrade > 0}
      <li class="flex items-center justify-between gap-3 py-2">
        <span
          >{impact.listsToDowngrade > 1
            ? m.settings_privacy_private_lists()
            : m.settings_privacy_private_list()}</span>
        <span class="timecode text-fg font-semibold"
          >{impact.listsToDowngrade}</span>
      </li>
    {/if}
    {#if impact.followersToRemove === 0 && impact.outgoingFollowsToCancel === 0 && impact.listsToDowngrade === 0}
      <li class="text-dim py-2">
        {m.settings_privacy_nothing_to_clean()}
      </li>
    {/if}
  </ul>
  <p class="text-dim mt-4 text-xs">
    {m.settings_privacy_anonymity_warning()}
  </p>
  <div class="mt-5 flex justify-end gap-2">
    <button
      type="button"
      class="btn btn-ghost"
      disabled={loading}
      onclick={onclose}>
      {m.common_cancel()}
    </button>
    <button
      type="button"
      class="btn btn-danger"
      disabled={loading}
      onclick={onconfirm}>
      {m.settings_privacy_become_ghost()}
    </button>
  </div>
</Modal>
