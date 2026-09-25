<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import { currentHomeGate } from "$lib/home/gate";
  import {
    appDestinations,
    describeQuickLink,
    isWebAddress,
  } from "$lib/home/quick-links";
  import { m } from "$lib/paraglide/messages.js";
  import { prefersReducedMotion } from "$lib/motion";
  import { HOME_LAYOUT_LIMITS, type HomeQuickLinkDto } from "@loomkeep/shared";
  import { untrack } from "svelte";
  import { dndzone } from "svelte-dnd-action";
  import { fade } from "svelte/transition";

  let { links = $bindable() }: { links: HomeQuickLinkDto[] } = $props();

  const MAX = HOME_LAYOUT_LIMITS.quickLinks;
  const gate = $derived(currentHomeGate());

  // svelte-dnd-action wants its own `id` on every row (a link's `id` is the
  // screen it points to) and reassigns the rows mid-drag; the row ids only
  // live for this dialog.
  type Row = { id: number; link: HomeQuickLinkDto };
  let nextId = 0;
  const toRow = (link: HomeQuickLinkDto): Row => ({ id: nextId++, link });
  let rows = $state<Row[]>(untrack(() => links.map(toRow)));

  function commit(next: Row[]) {
    rows = next;
    links = next.map((row) => row.link);
  }

  const full = $derived(rows.length >= MAX);
  const usedScreens = $derived(
    new Set(rows.filter((r) => r.link.kind === "app").map((r) => r.link.id)),
  );
  const choices = $derived(
    appDestinations(gate).filter((d) => !usedScreens.has(d.id)),
  );

  let label = $state("");
  let url = $state("");
  let urlError = $state(false);

  function addCustom(event: SubmitEvent) {
    event.preventDefault();
    const address = url.trim();
    if (!isWebAddress(address)) {
      urlError = true;
      return;
    }
    const name = label.trim() || new URL(address).hostname;
    commit([...rows, toRow({ kind: "url", url: address, label: name })]);
    label = "";
    url = "";
    urlError = false;
  }

  const reduced = prefersReducedMotion();
</script>

<div class="space-y-5">
  <div>
    <p class="text-dim mb-2 text-xs font-semibold tracking-wide uppercase">
      {m.home_quick_links_config_yours()}
    </p>
    {#if rows.length === 0}
      <p class="text-dim text-sm">{m.home_quick_links_empty()}</p>
    {:else}
      <ul
        class="divide-border divide-y"
        use:dndzone={{ items: rows, flipDurationMs: reduced ? 0 : 150 }}
        onconsider={(e) => (rows = e.detail.items)}
        onfinalize={(e) => commit(e.detail.items)}>
        {#each rows as row, index (row.id)}
          {@const described = describeQuickLink(row.link, index)}
          <li class="flex items-center gap-3 py-2">
            <Icon name="grip" class="text-dim h-4 w-4 shrink-0 cursor-grab" />
            <Icon
              name={described?.icon ?? "link"}
              class="text-accent h-5 w-5 shrink-0" />
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-sm font-semibold {described?.reachable(
                  gate,
                )
                  ? ''
                  : 'text-dim'}">
                {described?.label ?? row.link.id}
              </span>
              {#if row.link.kind === "url"}
                <span class="timecode block truncate text-[0.65rem]">
                  {row.link.url}
                </span>
              {/if}
            </span>
            <button
              type="button"
              class="hover:bg-danger/10 hover:text-danger text-dim grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors"
              aria-label={m.common_remove()}
              onclick={() => commit(rows.filter((r) => r.id !== row.id))}>
              <Icon name="x" class="h-4 w-4" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if full}
      <p
        class="text-dim mt-2 text-xs"
        in:fade={{ duration: reduced ? 0 : 150 }}>
        {m.home_quick_links_config_limit({ count: MAX })}
      </p>
    {/if}
  </div>

  {#if choices.length > 0}
    <div class="border-border border-t pt-4">
      <p class="text-dim mb-2 text-xs font-semibold tracking-wide uppercase">
        {m.home_quick_links_config_app()}
      </p>
      <div class="flex flex-wrap gap-2">
        {#each choices as choice (choice.id)}
          <button
            type="button"
            class="chip inline-flex items-center gap-1.5 disabled:pointer-events-none disabled:opacity-40"
            disabled={full}
            onclick={() =>
              commit([...rows, toRow({ kind: "app", id: choice.id })])}>
            <Icon name={choice.icon} class="h-3.5 w-3.5" />
            {choice.label()}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <form class="border-border border-t pt-4" onsubmit={addCustom}>
    <p class="text-dim mb-2 text-xs font-semibold tracking-wide uppercase">
      {m.home_quick_links_config_custom()}
    </p>
    <div class="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <label class="block">
        <span class="sr-only">{m.common_name()}</span>
        <input
          class="input"
          name="label"
          maxlength={HOME_LAYOUT_LIMITS.labelLength}
          placeholder={m.common_name()}
          bind:value={label} />
      </label>
      <label class="block">
        <span class="sr-only">{m.home_quick_links_config_url()}</span>
        <input
          class="input"
          name="url"
          type="url"
          inputmode="url"
          maxlength={HOME_LAYOUT_LIMITS.urlLength}
          placeholder="https://"
          aria-invalid={urlError}
          bind:value={url}
          oninput={() => (urlError = false)} />
      </label>
    </div>
    {#if urlError}
      <p class="text-danger mt-1.5 text-xs" role="alert">
        {m.home_quick_links_config_invalid_url()}
      </p>
    {/if}
    <button
      type="submit"
      class="btn btn-ghost btn-sm mt-3 gap-1.5"
      disabled={full || !url.trim()}>
      <Icon name="plus" class="h-4 w-4" />
      {m.home_quick_links_config_add_custom()}
    </button>
  </form>
</div>
