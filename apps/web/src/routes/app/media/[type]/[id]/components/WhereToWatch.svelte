<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { formatRegion } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import { createWatchProviderToggle } from "$lib/watch-provider-toggle.svelte";
  import type { WatchProviderDto, WatchProvidersDto } from "@loomkeep/shared";

  let { offers }: { offers: WatchProvidersDto } = $props();

  const picker = createWatchProviderToggle();
  const mine = $derived(new Set(auth.user?.watchProviderIds ?? []));
  const pickedNone = $derived(mine.size === 0);
  let openId = $state<number | null>(null);

  const groups = $derived(
    [
      { label: m.media_streaming(), list: offers.flatrate },
      { label: m.media_free(), list: offers.free },
      { label: m.media_with_ads(), list: offers.ads },
      { label: m.media_rent(), list: offers.rent },
      { label: m.media_buy(), list: offers.buy },
    ]
      .filter((group) => group.list.length > 0)
      .map((group) => ({
        label: group.label,
        mine: group.list.filter((p) => mine.has(p.id)),
        others: group.list.filter((p) => !mine.has(p.id)),
      })),
  );

  const opened = $derived.by(() => {
    if (openId === null) return null;
    const all = groups.flatMap((g) => [...g.mine, ...g.others]);
    const provider = all.find((p) => p.id === openId);
    if (!provider) return null;
    const kinds = groups
      .filter((g) => [...g.mine, ...g.others].some((p) => p.id === openId))
      .map((g) => g.label.toLowerCase());
    return { provider, kinds };
  });

  function open(provider: WatchProviderDto) {
    openId = openId === provider.id ? null : provider.id;
  }
</script>

{#snippet logo(provider: WatchProviderDto, isMine: boolean)}
  <button
    type="button"
    class="relative rounded focus-visible:outline-2"
    aria-label={provider.name}
    aria-expanded={openId === provider.id}
    title={provider.name}
    onclick={() => open(provider)}>
    <span
      class="bg-surface-2 grid h-7 w-7 place-items-center overflow-hidden rounded transition {isMine ||
      pickedNone
        ? ''
        : 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0'}">
      {#if provider.logoUrl}
        <img
          src={provider.logoUrl}
          alt=""
          loading="lazy"
          class="h-full w-full object-cover" />
      {:else}
        <span class="text-dim text-[0.55rem] font-bold"
          >{provider.name.slice(0, 2)}</span>
      {/if}
    </span>
    {#if isMine}
      <span
        class="bg-accent text-accent-fg ring-bg absolute -right-1 -bottom-1 grid h-3.5 w-3.5 place-items-center rounded-full ring-2">
        <Icon name="check" class="h-2.5 w-2.5" />
      </span>
    {/if}
  </button>
{/snippet}

<section class="mt-6">
  <span class="timecode text-xs">{m.media_where_to_watch()}</span>
  <div class="mt-2 grid gap-2">
    {#each groups as group (group.label)}
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-dim w-16 shrink-0 text-[0.65rem]">{group.label}</span>
        {#each group.mine as provider (provider.id)}
          {@render logo(provider, true)}
        {/each}
        {#if group.mine.length > 0 && group.others.length > 0}
          <span class="bg-border mx-1 h-5 w-px" aria-hidden="true"></span>
        {/if}
        {#each group.others as provider (provider.id)}
          {@render logo(provider, false)}
        {/each}
      </div>
    {/each}
  </div>

  {#if opened}
    {@const isMine = mine.has(opened.provider.id)}
    <div
      class="bg-surface-2 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2 text-sm">
      <span class="min-w-0">
        <span class="font-semibold">{opened.provider.name}</span>
        <span class="text-dim"> · {opened.kinds.join(", ")}</span>
      </span>
      <span class="ml-auto flex flex-wrap items-center gap-3">
        {#if offers.link}
          <a
            href={offers.link}
            target="_blank"
            rel="noopener noreferrer"
            class="link-accent text-xs">
            {m.media_watch_offers_link()} ↗
          </a>
        {/if}
        <button
          type="button"
          class="btn btn-ghost py-1 text-xs"
          onclick={() => picker.toggle(opened.provider.id)}>
          {isMine ? m.media_watch_remove_mine() : m.media_watch_add_mine()}
        </button>
      </span>
    </div>
  {/if}

  {#if picker.error}
    <p class="text-danger mt-2 text-xs">{picker.error}</p>
  {/if}

  <p class="timecode text-dim text-micro mt-2">
    {m.media_watch_attribution({ region: formatRegion(offers.region) })}
  </p>
</section>
