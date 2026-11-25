<script lang="ts">
  import { API_URL } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getArrToken, regenerateArrToken } from "../api";
  import FeedLink from "../feeds/FeedLink.svelte";
  import FeedLinksModal from "../feeds/FeedLinksModal.svelte";

  // Import lists for Radarr and Sonarr (INT-09), from the pile or from one
  // of the member's lists.
  let {
    list = null,
    onclose,
  }: { list?: { id: string; title: string } | null; onclose: () => void } =
    $props();

  type Tool = "radarr" | "sonarr";
  const feedUrl = (tool: Tool, token: string) =>
    list
      ? `${API_URL}/lists/${list.id}/${tool}.json?token=${token}`
      : `${API_URL}/library/${tool}.json?token=${token}`;

  // Radarr and Sonarr's own menu labels: their UI is English-only.
  const feeds = $derived([
    {
      tool: "radarr" as const,
      name: "Radarr",
      title: list ? m.settings_arr_list_movies() : m.settings_arr_pile_movies(),
      path: ["Settings", "Lists", "+", "StevenLu Custom"],
    },
    {
      tool: "sonarr" as const,
      name: "Sonarr",
      title: list ? m.settings_arr_list_series() : m.settings_arr_pile_series(),
      path: ["Settings", "Import Lists", "+", "Custom List"],
    },
  ]);
</script>

<FeedLinksModal
  title={list
    ? m.settings_arr_list_title({ title: list.title })
    : m.settings_arr_title()}
  tokenKey={keys.arrSubscribe.token()}
  getToken={getArrToken}
  regenerateToken={regenerateArrToken}
  confirm={m.settings_arr_regenerate_confirm()}
  privacy={m.settings_arr_private()}
  {onclose}>
  {#snippet children(token)}
    <p class="text-dim text-sm">
      {list ? m.settings_arr_list_body() : m.settings_arr_pile_body()}
    </p>
    <div class="mt-4 flex flex-col gap-4">
      {#each feeds as feed (feed.tool)}
        <FeedLink url={feedUrl(feed.tool, token)} label={feed.title}>
          {#snippet hint()}
            <p class="flex flex-wrap items-center gap-1 leading-6">
              {m.settings_arr_how_in({ tool: feed.name })}
              {#each feed.path as step, i (step)}
                {#if i > 0}<span aria-hidden="true">›</span>{/if}
                <kbd
                  class="border-border bg-surface text-fg rounded border px-1.5 py-0.5 font-mono text-[0.6875rem]">
                  {step}
                </kbd>
              {/each}
              {m.settings_arr_how_paste()}
            </p>
          {/snippet}
        </FeedLink>
      {/each}
    </div>
    <p class="text-dim mt-4 text-xs">{m.settings_arr_skipped()}</p>
  {/snippet}
</FeedLinksModal>
