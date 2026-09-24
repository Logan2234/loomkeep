<script lang="ts">
  import { API_URL } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { m } from "$lib/paraglide/messages";
  import { toast } from "$lib/toast.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { getCalendarToken, regenerateCalendarToken } from "../api";

  let { onclose }: { onclose: () => void } = $props();

  let confirmingRegenerate = $state(false);
  // Which of the three links was just copied, for its button's feedback.
  let copied = $state<Link | null>(null);

  const tokenQuery = createApiQuery(() => ({
    key: keys.calendarSubscribe.token(),
    fetch: getCalendarToken,
  }));
  const token = $derived(tokenQuery.data?.token ?? null);
  const loading = $derived(tokenQuery.loading);

  // One token feeds the calendar and the release feed alike.
  type Link = "ics" | "rss" | "atom";
  const LINK_PATHS: Record<Link, string> = {
    ics: "library/calendar.ics",
    rss: "library/releases.rss",
    atom: "library/releases.atom",
  };
  const linkUrl = (link: Link, t: string): string =>
    `${API_URL}/${LINK_PATHS[link]}?token=${t}`;
  const calendarUrl = (t: string): string => linkUrl("ics", t);

  async function copyLink(link: Link) {
    if (!token) return;
    await navigator.clipboard.writeText(linkUrl(link, token));
    copied = link;
    setTimeout(() => {
      if (copied === link) copied = null;
    }, 2000);
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
      <button class="btn btn-primary" onclick={() => copyLink("ics")}>
        <Icon name={copied === "ics" ? "check" : "link"} class="h-4 w-4" />
        {copied === "ics" ? m.common_link_copied() : m.common_copy_link()}
      </button>
    </div>

    <div class="border-border mt-6 border-t pt-5">
      <p class="flex items-center gap-2 font-semibold">
        {m.calendar_feed_title()}
        {#if isFeatureNew("release-feed")}<NewBadge />{/if}
      </p>
      <p class="text-dim mt-1 text-sm">{m.calendar_feed_description()}</p>
      <div class="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={() => copyLink("rss")}>
          <Icon name={copied === "rss" ? "check" : "link"} class="h-4 w-4" />
          {copied === "rss"
            ? m.common_link_copied()
            : m.calendar_feed_copy_rss()}
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          onclick={() => copyLink("atom")}>
          <Icon name={copied === "atom" ? "check" : "link"} class="h-4 w-4" />
          {copied === "atom"
            ? m.common_link_copied()
            : m.calendar_feed_copy_atom()}
        </button>
      </div>
    </div>
  {/if}
</Modal>
