<script lang="ts">
  import { API_URL } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { CopyFeedback } from "#lib/clipboard.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { getCalendarToken } from "../api";

  // Import lists for Radarr and Sonarr (INT-09), from the pile or from one
  // of the member's lists. They ride on the calendar's token.
  let {
    list = null,
    onclose,
  }: { list?: { id: string; title: string } | null; onclose: () => void } =
    $props();

  const tokenQuery = createApiQuery(() => ({
    key: keys.calendarSubscribe.token(),
    fetch: getCalendarToken,
  }));
  const token = $derived(tokenQuery.data?.token ?? null);

  type Tool = "radarr" | "sonarr";
  const feedUrl = (tool: Tool, t: string) =>
    list
      ? `${API_URL}/lists/${list.id}/${tool}.json?token=${t}`
      : `${API_URL}/library/${tool}.json?token=${t}`;

  const copyFeedback = new CopyFeedback<Tool>();
  $effect(() => () => copyFeedback.reset());

  const feeds = $derived([
    {
      tool: "radarr" as const,
      title: list ? m.settings_arr_list_movies() : m.settings_arr_pile_movies(),
      how: m.settings_arr_radarr_how(),
    },
    {
      tool: "sonarr" as const,
      title: list ? m.settings_arr_list_series() : m.settings_arr_pile_series(),
      how: m.settings_arr_sonarr_how(),
    },
  ]);
</script>

<Modal
  title={list
    ? m.settings_arr_list_title({ title: list.title })
    : m.settings_arr_title()}
  {onclose}>
  {#if tokenQuery.loading}
    <p class="text-dim text-sm">{m.calendar_link_generating()}</p>
  {:else if tokenQuery.error || !token}
    <p class="text-danger text-sm">{tokenQuery.error}</p>
  {:else}
    <p class="text-dim text-sm">
      {list ? m.settings_arr_list_body() : m.settings_arr_pile_body()}
    </p>
    <div class="mt-4 flex flex-col gap-4">
      {#each feeds as feed (feed.tool)}
        {@const url = feedUrl(feed.tool, token)}
        <div class="flex flex-col gap-1.5">
          <p class="text-sm font-semibold">{feed.title}</p>
          <div
            class="bg-surface-2 flex min-w-0 items-center gap-2 rounded-lg py-1.5 pr-1.5 pl-3">
            <code class="min-w-0 flex-1 truncate text-xs">{url}</code>
            <button
              type="button"
              class="btn btn-ghost btn-sm shrink-0"
              onclick={() => copyFeedback.copy(url, feed.tool)}>
              <Icon
                name={copyFeedback.value === feed.tool ? "check" : "link"}
                class="h-4 w-4" />
              {copyFeedback.value === feed.tool
                ? m.common_link_copied()
                : m.common_copy_link()}
            </button>
          </div>
          <p class="text-dim text-xs">{feed.how}</p>
        </div>
      {/each}
    </div>
    <p class="text-dim mt-5 text-xs">{m.settings_arr_private()}</p>
  {/if}
</Modal>
