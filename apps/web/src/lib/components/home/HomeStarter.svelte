<script lang="ts">
  import { getTrendingMedia, upsertLibraryEntry } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { MediaSummaryDto } from "@loomkeep/shared";
  import { SvelteSet } from "svelte/reactivity";

  // A new account's home, until its first title: one screen to start from
  // instead of a column of empty widgets. The first add fills the real home
  // (the checklist step it hangs on is pushed over the socket).
  const trendingQuery = createApiQuery(() => ({
    key: keys.catalog.trending(),
    fetch: getTrendingMedia,
    retry: 0,
  }));
  const trending = $derived((trendingQuery.data ?? []).slice(0, 9));

  const added = new SvelteSet<string>();
  const addMut = createApiMutation(() => ({
    mutate: (media: MediaSummaryDto) =>
      upsertLibraryEntry({
        source: media.source,
        sourceId: media.sourceId,
        type: media.type,
        status: "PLANNED",
      }),
    onSuccess: (_, media) => added.add(media.sourceId),
    errorToast: true,
  }));
</script>

<EmptyState art="projector" title={m.home_starter_title()} class="pt-4">
  <p class="text-sm">{m.home_starter_body()}</p>
  <div class="mt-5 flex w-full max-w-sm flex-col gap-2">
    <a href="/app/search" class="btn btn-primary h-12">
      <Icon name="search" class="h-4 w-4" />
      {m.home_starter_search()}
    </a>
    <a href="/app/settings/import" class="btn btn-ghost h-12">
      <Icon name="download" class="h-4 w-4" />
      {m.home_starter_import()}
    </a>
  </div>
</EmptyState>

{#if trending.length > 0}
  <section class="mt-4">
    <h2 class="font-display mb-3 flex items-center gap-2 text-base font-bold">
      <Icon name="sparkles" class="text-accent h-4 w-4" />
      {m.home_starter_trending()}
    </h2>
    <ul class="grid grid-cols-3 gap-2">
      {#each trending as media (media.sourceId)}
        {@const done = added.has(media.sourceId)}
        <li class="relative">
          <Poster src={media.posterUrl} title={media.title} alt={media.title} />
          <button
            type="button"
            class="absolute right-1.5 bottom-1.5 grid h-9 w-9 place-items-center rounded-full shadow-md transition-colors duration-200 {done
              ? 'bg-success text-btn-fg'
              : 'bg-btn text-btn-fg'}"
            disabled={done ||
              (addMut.loading && addMut.variables?.sourceId === media.sourceId)}
            aria-label={m.home_starter_add({ title: media.title })}
            onclick={() => addMut.mutate(media)}>
            <Icon name={done ? "check" : "plus"} class="h-4 w-4" />
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}
