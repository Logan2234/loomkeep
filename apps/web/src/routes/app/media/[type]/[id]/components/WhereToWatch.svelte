<script lang="ts">
  import { auth } from "#lib/auth.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { createWatchProviderToggle } from "#lib/watch-provider-toggle.svelte.js";
  import type { WatchProviderDto, WatchProvidersDto } from "@loomkeep/shared";

  let { offers }: { offers: WatchProvidersDto } = $props();

  const picker = createWatchProviderToggle();
  const mine = $derived(new Set(auth.user?.watchProviderIds ?? []));
  let openId = $state<number | null>(null);
  let showingOthers = $state(false);

  const groups = $derived(
    [
      { label: m.media_streaming(), list: offers.flatrate },
      { label: m.media_free(), list: offers.free },
      { label: m.media_with_ads(), list: offers.ads },
      { label: m.media_rent(), list: offers.rent },
      { label: m.media_buy(), list: offers.buy },
    ].filter((group) => group.list.length > 0),
  );

  function unique(lists: WatchProviderDto[][]): WatchProviderDto[] {
    const byId = new Map(lists.flat().map((p) => [p.id, p]));
    return [...byId.values()];
  }

  // The user's services; without any here, what comes with a subscription or
  // for free, and only then what has to be paid for.
  const featured = $derived.by(() => {
    const all = unique(groups.map((group) => group.list));
    const own = all.filter((p) => mine.has(p.id));
    if (own.length > 0) return own;
    const included = unique([offers.flatrate, offers.free, offers.ads]);
    return included.length > 0 ? included : all;
  });
  const featuredIds = $derived(new Set(featured.map((p) => p.id)));
  const otherGroups = $derived(
    groups
      .map((group) => ({
        label: group.label,
        list: group.list.filter((p) => !featuredIds.has(p.id)),
      }))
      .filter((group) => group.list.length > 0),
  );

  const opened = $derived.by(() => {
    if (openId === null) return null;
    const provider = unique(groups.map((group) => group.list)).find(
      (p) => p.id === openId,
    );
    if (!provider) return null;
    const kinds = groups
      .filter((group) => group.list.some((p) => p.id === openId))
      .map((group) => group.label.toLowerCase());
    return { provider, kinds };
  });

  function open(provider: WatchProviderDto) {
    openId = openId === provider.id ? null : provider.id;
  }
</script>

{#snippet tile(provider: WatchProviderDto, size: string)}
  <span
    class="bg-surface-2 grid {size} shrink-0 place-items-center overflow-hidden rounded-lg">
    {#if provider.logoUrl}
      <img
        src={provider.logoUrl}
        alt=""
        loading="lazy"
        class="h-full w-full object-cover" />
    {:else}
      <span class="text-dim text-[0.6rem] font-bold"
        >{provider.name.slice(0, 2)}</span>
    {/if}
  </span>
{/snippet}

<section class="mt-6">
  <span class="timecode text-xs">{m.media_where_to_watch()}</span>
  <div class="no-scrollbar -mx-5 mt-2 flex gap-2.5 overflow-x-auto px-5 py-1">
    {#each featured as provider (provider.id)}
      <button
        type="button"
        class="shrink-0 rounded-lg transition-transform focus-visible:outline-2 active:scale-95"
        aria-label={provider.name}
        aria-expanded={openId === provider.id}
        title={provider.name}
        onclick={() => open(provider)}>
        {@render tile(provider, "h-10 w-10")}
      </button>
    {/each}
  </div>

  {#if otherGroups.length > 0}
    <button
      type="button"
      class="btn-text mt-1 text-xs"
      onclick={() => (showingOthers = true)}>
      {m.media_watch_other_options()}
      <Icon name="chevron-right" class="h-3.5 w-3.5" />
    </button>
  {/if}

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
</section>

{#if showingOthers}
  <Modal
    title={m.media_watch_other_options()}
    onclose={() => (showingOthers = false)}>
    <div class="flex flex-col gap-4">
      {#each otherGroups as group (group.label)}
        <div>
          <h3 class="timecode mb-1 text-xs">{group.label}</h3>
          <ul>
            {#each group.list as provider (provider.id)}
              <li>
                <button
                  type="button"
                  aria-label={provider.name}
                  class="hover:bg-surface-2 flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
                  onclick={() => {
                    showingOthers = false;
                    openId = provider.id;
                  }}>
                  {@render tile(provider, "h-8 w-8")}
                  <span class="min-w-0 flex-1">{provider.name}</span>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  </Modal>
{/if}
