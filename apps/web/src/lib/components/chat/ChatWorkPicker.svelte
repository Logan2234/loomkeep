<script lang="ts">
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { searchWorks } from "#lib/chat/work-search.js";
  import Poster from "#lib/components/Poster.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { MessageWorkDto } from "@loomkeep/shared";
  import { scale } from "svelte/transition";
  import { workKindLabel } from "./conversation-presentation";

  let {
    query,
    onpick,
    oncancel,
  }: {
    /** What follows `/reco `. */
    query: string;
    onpick: (work: MessageWorkDto) => void;
    oncancel: () => void;
  } = $props();

  const reduced = prefersReducedMotion();
  const MIN_LENGTH = 2;

  let searched = $state("");
  let highlighted = $state(0);
  let list = $state<HTMLElement | null>(null);

  // The list scrolls inside the panel: keep the highlighted work in view.
  $effect(() => {
    void highlighted;
    list
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  });

  $effect(() => {
    const next = query.trim();
    const timer = setTimeout(() => (searched = next), 300);
    return () => clearTimeout(timer);
  });

  const worksQuery = createApiQuery(() => ({
    key: keys.chat.workSearch(searched),
    fetch: () => searchWorks(searched),
    enabled: searched.length >= MIN_LENGTH,
    keepPreviousData: true,
  }));
  const works = $derived(
    searched.length >= MIN_LENGTH ? (worksQuery.data ?? []) : [],
  );

  $effect(() => {
    void works;
    highlighted = 0;
  });

  /** The composer's keys while the picker is open; true when handled here. */
  export function handleKey(event: KeyboardEvent): boolean {
    if (event.key === "Escape") {
      event.preventDefault();
      oncancel();
      return true;
    }

    if (works.length === 0) return event.key === "Enter";

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : works.length - 1;
      highlighted = (highlighted + step) % works.length;
      return true;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      onpick(works[highlighted]);
      return true;
    }

    return false;
  }
</script>

<div
  transition:scale={{ duration: reduced ? 0 : 150, start: 0.97 }}
  bind:this={list}
  class="border-border bg-surface absolute inset-x-0 bottom-full z-30 mb-2 max-h-64 overflow-y-auto rounded-xl border p-1.5 shadow-xl"
  style="transform-origin: bottom left;">
  {#if works.length > 0}
    <div role="listbox" aria-label={m.common_works()}>
      {#each works as work, index (work.href)}
        <button
          type="button"
          role="option"
          aria-selected={highlighted === index}
          class="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-150
            {highlighted === index ? 'bg-surface-2' : ''}"
          onmousedown={(e) => e.preventDefault()}
          onmouseenter={() => (highlighted = index)}
          onclick={() => onpick(work)}>
          <span class="w-[26px] shrink-0 overflow-hidden rounded">
            <Poster
              src={work.imageUrl}
              title={work.title}
              alt=""
              caption={false} />
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold"
              >{work.title}</span>
            <span class="text-dim block font-mono text-[0.68rem] uppercase">
              {workKindLabel(work.kind)}{work.year ? ` · ${work.year}` : ""}
            </span>
          </span>
        </button>
      {/each}
    </div>
  {:else}
    <p class="text-dim px-2.5 py-2 text-sm" aria-live="polite">
      {searched.length < MIN_LENGTH
        ? m.chat_reco_prompt()
        : worksQuery.loading
          ? m.common_loading()
          : m.common_no_results()}
    </p>
  {/if}
</div>
