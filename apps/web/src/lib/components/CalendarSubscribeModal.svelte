<script lang="ts">
  import {
    API_URL,
    getCalendarToken,
    regenerateCalendarToken,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { m } from "$lib/paraglide/messages";
  import { toast } from "$lib/toast.svelte";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";

  let { onclose }: { onclose: () => void } = $props();

  let confirmingRegenerate = $state(false);
  let copied = $state(false);

  const tokenQuery = createApiQuery(() => ({
    key: keys.calendarSubscribe.token(),
    fetch: getCalendarToken,
  }));
  const token = $derived(tokenQuery.data?.token ?? null);
  const loading = $derived(tokenQuery.loading);

  const calendarUrl = (t: string): string =>
    `${API_URL}/library/calendar.ics?token=${t}`;

  async function copyLink() {
    if (!token) return;
    await navigator.clipboard.writeText(calendarUrl(token));
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  const regenerateMut = createApiMutation(() => ({
    mutate: regenerateCalendarToken,
    onSuccess: async (result) => {
      confirmingRegenerate = false;
      await navigator.clipboard.writeText(calendarUrl(result.token));
      toast.success(m.calendar_link_regenerated());
    },
  }));

  function regenerate() {
    regenerateMut.mutate();
  }
</script>

<Modal title={m.calendar_subscribe_button()} {onclose}>
  {#if loading}
    <p class="text-dim text-sm">{m.calendar_link_generating()}</p>
  {:else if tokenQuery.error && !token}
    <p class="text-danger text-sm">{tokenQuery.error}</p>
  {:else if confirmingRegenerate}
    <p class="text-dim text-sm">
      {m.calendar_link_regenerate_confirm()}
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
      {m.calendar_subscription_description()}
    </p>
    <p class="text-dim mt-2 text-sm">
      {m.calendar_subscription_private()}
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
        {copied ? m.common_link_copied() : m.common_copy_link()}
      </button>
    </div>
  {/if}
</Modal>
