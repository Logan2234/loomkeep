<script lang="ts">
  import SettingsSection from "../components/SettingsSection.svelte";

  import { page } from "$app/state";
  import { getWatchProviderCatalog, updateMe } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { flipChildren } from "#lib/actions/flipChildren.js";
  import { auth } from "#lib/auth.svelte.js";
  import Combobox from "#lib/components/Combobox.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { formatRegion } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { createWatchProviderToggle } from "#lib/watch-provider-toggle.svelte.js";
  import type { WatchProviderDto } from "@loomkeep/shared";
  import { flip } from "svelte/animate";
  import { backOut } from "svelte/easing";
  import { scale, slide } from "svelte/transition";
  import { flashAnchor } from "../flash-anchor";

  const reduced = prefersReducedMotion();

  // Enough to hold the services most people have, one tap away.
  const FEATURED_COUNT = 20;

  const picked = $derived(auth.user?.watchRegion ?? null);
  const catalogQuery = createApiQuery(() => ({
    key: keys.catalog.watchProviders(picked),
    fetch: () => getWatchProviderCatalog(picked ?? undefined),
  }));
  const catalog = $derived(catalogQuery.data);

  const regionOptions = $derived(
    (catalog?.regions ?? [])
      .map((code) => ({ code, name: formatRegion(code) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  const regionChoices = $derived([
    {
      value: "",
      label:
        picked === null && catalog
          ? m.settings_streaming_region_auto({
              region: formatRegion(catalog.region),
            })
          : m.settings_streaming_region_auto_plain(),
    },
    ...regionOptions.map((option) => ({
      value: option.code,
      label: option.name,
    })),
  ]);

  const regionMut = createApiMutation(() => ({
    mutate: (watchRegion: string | null) => updateMe({ watchRegion }),
  }));

  const picker = createWatchProviderToggle();
  const mine = $derived(new Set(auth.user?.watchProviderIds ?? []));

  // The featured grid also keeps the user's own picks from further down the
  // list, so every service they have stays in sight.
  const featured = $derived(
    (catalog?.providers ?? []).filter(
      (p, index) => index < FEATURED_COUNT || mine.has(p.id),
    ),
  );
  const rest = $derived(
    (catalog?.providers ?? []).filter(
      (p, index) => index >= FEATURED_COUNT && !mine.has(p.id),
    ),
  );

  let showMore = $state(false);
  let search = $state("");
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const matchingRest = $derived(
    search.trim()
      ? rest.filter((p) => normalize(p.name).includes(normalize(search.trim())))
      : rest,
  );

  function countLabel(count: number): string {
    if (count === 0) return m.settings_streaming_count_none();
    return count > 1
      ? m.settings_streaming_count_many({ count })
      : m.settings_streaming_count_one();
  }
</script>

{#snippet tile(provider: WatchProviderDto)}
  {@const isMine = mine.has(provider.id)}
  <button
    type="button"
    aria-pressed={isMine}
    class="relative grid justify-items-center gap-1 rounded-lg border px-1 py-2 text-center text-[0.68rem] leading-tight transition-colors {isMine
      ? 'border-accent bg-accent/10 text-fg'
      : 'border-border text-dim hover:text-fg'}"
    onclick={() => picker.toggle(provider.id)}>
    <span class="bg-surface-2 block h-10 w-10 overflow-hidden rounded-lg">
      {#if provider.logoUrl}
        <img
          src={provider.logoUrl}
          alt=""
          loading="lazy"
          class="h-full w-full object-cover" />
      {/if}
    </span>
    <span class="w-full truncate">{provider.name}</span>
  </button>
{/snippet}

<SettingsSection slug="streaming">
  <div class="space-y-3">
    <section
      id="streaming-region"
      use:flashAnchor={{ anchor: "streaming-region", hash: page.url.hash }}
      class="card flex flex-wrap items-center justify-between gap-3 p-5 md:p-6">
      <div class="min-w-0">
        <p class="font-semibold">{m.settings_streaming_region_label()}</p>
        <p class="text-dim mt-1 max-w-xl text-sm">
          {m.settings_streaming_region_body()}
        </p>
      </div>
      <Combobox
        label={m.settings_streaming_region_label()}
        options={regionChoices}
        values={[picked ?? ""]}
        searchable
        disabled={!catalog || regionMut.loading}
        onChange={([code]) => regionMut.mutate(code || null)} />
      {#if regionMut.error}
        <p class="text-danger w-full text-sm">{regionMut.error}</p>
      {/if}
    </section>

    <section
      id="streaming-services"
      use:flashAnchor={{ anchor: "streaming-services", hash: page.url.hash }}
      class="card p-5 md:p-6">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="font-semibold">{m.settings_streaming_title()}</p>
        <span class="timecode text-xs">{countLabel(mine.size)}</span>
      </div>
      <p class="text-dim mt-1 max-w-xl text-sm">
        {m.settings_streaming_services_body()}
      </p>

      {#if catalogQuery.error}
        <p class="text-danger mt-4 text-sm">{catalogQuery.error}</p>
      {:else if !catalog}
        <p class="timecode mt-4 text-xs">{m.common_loading()}</p>
      {:else}
        <div
          class="mt-4 grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-2">
          {#each featured as provider (provider.id)}
            <div
              class="grid"
              animate:flip={{ duration: reduced ? 0 : 220 }}
              in:scale={{
                start: 0.6,
                duration: reduced ? 0 : 260,
                easing: backOut,
              }}>
              {@render tile(provider)}
            </div>
          {/each}
        </div>

        {#if rest.length > 0}
          <div class="border-border mt-4 border-t pt-3">
            <button
              type="button"
              class="text-accent inline-flex items-center gap-1 text-sm font-semibold"
              aria-expanded={showMore}
              onclick={() => (showMore = !showMore)}>
              <Icon
                name="chevron-right"
                class="h-4 w-4 transition-transform {showMore
                  ? 'rotate-90'
                  : ''}" />
              {m.settings_streaming_more({ count: rest.length })}
            </button>
            {#if showMore}
              <div transition:slide={{ duration: reduced ? 0 : 220 }}>
                <input
                  type="search"
                  class="input mt-3 w-full"
                  placeholder={m.settings_streaming_search_placeholder()}
                  aria-label={m.settings_streaming_search_placeholder()}
                  bind:value={search} />
                <div
                  class="relative mt-3 grid max-h-80 grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-2 overflow-y-auto p-0.5"
                  use:flipChildren={{ duration: reduced ? 0 : 220 }}>
                  {#each matchingRest as provider (provider.id)}
                    {@render tile(provider)}
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      {/if}

      {#if picker.error}
        <p class="text-danger mt-3 text-sm">{picker.error}</p>
      {/if}

      <p class="timecode text-dim text-micro mt-4">
        {m.media_watch_attribution({
          region: formatRegion(catalog?.region ?? picked ?? "US"),
        })}
      </p>
    </section>
  </div>
</SettingsSection>
