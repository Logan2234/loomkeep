<script lang="ts">
  // Search in one conversation or one work's discussion: a bar under its
  // header, the results below it over the messages. Picking one brings it
  // into view.
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { formatDate } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { CHAT_SEARCH_MIN_LENGTH } from "@loomkeep/shared";
  import { slide } from "svelte/transition";
  import type { SearchHit } from "./conversation-presentation";

  let {
    key,
    search,
    label = m.chat_search_messages(),
    onpick,
    onclose,
  }: {
    key: (query: string) => readonly unknown[];
    label?: string;
    search: (query: string) => Promise<SearchHit[]>;
    onpick: (id: string) => void;
    onclose: () => void;
  } = $props();

  const reduced = prefersReducedMotion();
  let input = $state<HTMLInputElement | null>(null);
  let typed = $state("");
  let query = $state("");

  $effect(() => {
    const next = typed.trim();
    const timer = setTimeout(() => (query = next), 250);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    input?.focus();
  });

  const resultsQuery = createApiQuery(() => ({
    key: key(query),
    fetch: () => search(query),
    enabled: query.length >= CHAT_SEARCH_MIN_LENGTH,
    keepPreviousData: true,
  }));
  const results = $derived(
    query.length >= CHAT_SEARCH_MIN_LENGTH ? (resultsQuery.data ?? []) : [],
  );
</script>

<div
  transition:slide={{ duration: reduced ? 0 : 200 }}
  class="border-border bg-surface relative z-20 shrink-0 border-b px-3 py-2">
  <div class="flex items-center gap-2">
    <div class="relative min-w-0 flex-1">
      <Icon
        name="search"
        class="text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <input
        bind:this={input}
        bind:value={typed}
        data-chat-search
        aria-label={label}
        placeholder={label}
        class="input focus:border-accent h-9 py-0 pl-9 text-sm transition-colors duration-150"
        onkeydown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onclose();
          }
        }} />
    </div>
    <button
      type="button"
      class="btn-icon"
      aria-label={m.common_close()}
      onclick={onclose}>
      <Icon name="x" class="h-4 w-4" />
    </button>
  </div>

  {#if query.length >= CHAT_SEARCH_MIN_LENGTH}
    <div
      transition:slide={{ duration: reduced ? 0 : 150 }}
      class="border-border bg-surface absolute inset-x-0 top-full z-30 max-h-72 overflow-y-auto border-b shadow-lg">
      {#each results as result (result.id)}
        <button
          type="button"
          class="hover:bg-surface-2 flex w-full flex-col gap-0.5 px-4 py-2 text-left transition-colors duration-150"
          onclick={() => onpick(result.id)}>
          <span class="text-dim font-mono text-[0.65rem]">
            {result.who} · {formatDate(result.createdAt, {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
            })}
          </span>
          <span class="line-clamp-2 text-sm">{result.text}</span>
        </button>
      {:else}
        <p class="text-dim px-4 py-3 text-sm" aria-live="polite">
          {resultsQuery.loading ? m.common_loading() : m.common_no_results()}
        </p>
      {/each}
    </div>
  {/if}
</div>
