<script lang="ts">
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import {
    getPersonalInvitation,
    renewPersonalInvitation,
  } from "#lib/api/social.js";
  import { CopyFeedback } from "#lib/ui/clipboard.svelte.js";
  import Icon from "#lib/ui/Icon.svelte";
  import Modal from "#lib/ui/Modal.svelte";
  import { isNativeShareAvailable, shareNatively } from "#lib/native/share.js";
  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/ui/toast-store.svelte.js";

  // The member's own sign-up link (SOC-02): whoever signs up with it and the
  // member follow each other.
  let { onclose }: { onclose: () => void } = $props();

  const invitationQuery = createApiQuery(() => ({
    key: keys.social.invitation(),
    fetch: getPersonalInvitation,
  }));
  const invitation = $derived(invitationQuery.data);

  const copyFeedback = new CopyFeedback();
  $effect(() => () => copyFeedback.reset());

  const canShare =
    isNativeShareAvailable() || typeof navigator.share === "function";

  async function share() {
    if (!invitation) return;
    const data = { title: m.chat_invite_share_text(), url: invitation.url };
    if (isNativeShareAvailable()) {
      await shareNatively(data);
      return;
    }
    try {
      await navigator.share(data);
    } catch {
      // Closing the sheet without picking anything isn't a failure.
    }
  }

  let confirmingRenew = $state(false);
  const renewMut = createApiMutation(() => ({
    mutate: renewPersonalInvitation,
    invalidates: [keys.social.invitation()],
    onSuccess: async (result) => {
      confirmingRenew = false;
      if (await copyFeedback.copy(result.url, true))
        toast.success(m.chat_invite_renewed());
    },
  }));
</script>

<Modal title={m.chat_invite_title()} {onclose}>
  {#if invitationQuery.loading}
    <p class="text-dim text-sm">{m.common_loading()}</p>
  {:else if invitationQuery.error || !invitation}
    <p class="text-danger text-sm">{invitationQuery.error}</p>
  {:else if confirmingRenew}
    <p class="text-dim text-sm">{m.chat_invite_renew_confirm()}</p>
    {#if renewMut.error}
      <p class="text-danger mt-2 text-sm">{renewMut.error}</p>
    {/if}
    <div class="mt-5 flex justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        disabled={renewMut.loading}
        onclick={() => (confirmingRenew = false)}>
        {m.common_cancel()}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        disabled={renewMut.loading}
        onclick={() => renewMut.mutate()}>
        {renewMut.loading ? m.common_regenerating() : m.chat_invite_renew()}
      </button>
    </div>
  {:else}
    <p class="text-dim text-sm">{m.chat_invite_body()}</p>
    <p
      class="bg-surface-2 mt-4 truncate rounded-lg px-3 py-2.5 font-mono text-xs select-all">
      {invitation.url}
    </p>
    <div class="mt-3 grid gap-2 {canShare ? 'grid-cols-2' : ''}">
      <button
        type="button"
        class="btn btn-primary justify-center"
        onclick={() => copyFeedback.copy(invitation.url, true)}>
        <Icon name={copyFeedback.value ? "check" : "link"} class="h-4 w-4" />
        {copyFeedback.value ? m.common_link_copied() : m.common_copy_link()}
      </button>
      {#if canShare}
        <button
          type="button"
          class="btn btn-ghost justify-center"
          onclick={share}>
          <Icon name="share" class="h-4 w-4" />
          {m.chat_invite_share()}
        </button>
      {/if}
    </div>
    <div
      class="text-dim mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>{m.chat_invite_renew_hint()}</span>
      <button
        type="button"
        class="text-accent font-semibold"
        onclick={() => (confirmingRenew = true)}>
        {m.chat_invite_renew()}
      </button>
    </div>
    {#if invitation.joinedCount > 0}
      <p class="timecode mt-3 text-xs">
        {invitation.joinedCount === 1
          ? m.chat_invite_joined_one({ count: invitation.joinedCount })
          : m.chat_invite_joined_many({ count: invitation.joinedCount })}
      </p>
    {/if}
  {/if}
</Modal>
