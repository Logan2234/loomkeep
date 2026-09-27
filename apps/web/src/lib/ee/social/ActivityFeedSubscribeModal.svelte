<script lang="ts">
  import { API_URL } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { m } from "$lib/paraglide/messages";
  import { toast } from "$lib/toast.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import { getActivityFeedToken, regenerateActivityFeedToken } from "../api";

  let { onclose }: { onclose: () => void } = $props();

  let confirmingRegenerate = $state(false);
  let copied = $state(false);

  const tokenQuery = createApiQuery(() => ({
    key: keys.activityFeedSubscribe.token(),
    fetch: getActivityFeedToken,
  }));
  const token = $derived(tokenQuery.data?.token ?? null);
  const loading = $derived(tokenQuery.loading);

  const feedUrl = (t: string): string =>
    `${API_URL}/social/activity.atom?token=${t}`;

  async function copyLink() {
    if (!token) return;
    await navigator.clipboard.writeText(feedUrl(token));
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 2000);
  }

  const regenerateMut = createApiMutation(() => ({
    mutate: regenerateActivityFeedToken,
    onSuccess: async (result) => {
      confirmingRegenerate = false;
      await navigator.clipboard.writeText(feedUrl(result.token));
      toast.success(m.activity_feed_link_regenerated());
    },
  }));

  function regenerate() {
    regenerateMut.mutate();
  }
</script>

<Modal title={m.activity_feed_subscribe_button()} {onclose}>
  {#if loading}
    <p class="text-dim text-sm">{m.calendar_link_generating()}</p>
  {:else if tokenQuery.error && !token}
    <p class="text-danger text-sm">{tokenQuery.error}</p>
  {:else if confirmingRegenerate}
    <p class="text-dim text-sm">
      {m.activity_feed_link_regenerate_confirm()}
    </p>
    {#if regenerateMut.error}
      <p class="text-danger mt-2 text-sm">{regenerateMut.error}</p>
    {/if}
    <div class="mt-5 flex justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        disabled={regenerateMut.loading}
        onclick={() => (confirmingRegenerate = false)}>
        {m.common_cancel()}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        disabled={regenerateMut.loading}
        onclick={regenerate}>
        {regenerateMut.loading
          ? m.common_regenerating()
          : m.common_regenerate()}
      </button>
    </div>
  {:else}
    <p class="text-dim text-sm">
      {m.activity_feed_subscription_description()}
    </p>
    <p class="text-dim mt-2 text-sm">
      {m.activity_feed_subscription_private()}
    </p>
    <div class="mt-5 flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        onclick={() => (confirmingRegenerate = true)}>
        {m.calendar_link_regenerate()}
      </button>
      <button class="btn btn-primary" onclick={copyLink}>
        <Icon name={copied ? "check" : "link"} class="h-4 w-4" />
        {copied ? m.common_link_copied() : m.activity_feed_copy_atom()}
      </button>
    </div>
  {/if}
</Modal>
