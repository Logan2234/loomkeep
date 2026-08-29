<script lang="ts">
  // Drill-down for a clicked rating/decade bar: the works behind that count.
  import Modal from "$lib/components/Modal.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import type { StatsWorkDto } from "@loomkeep/shared";
  import { STATS_DOMAIN_LABEL } from "./stats-domain";

  let {
    title,
    works,
    loading,
    error = null,
    onclose,
  }: {
    title: string;
    works: StatsWorkDto[];
    loading: boolean;
    error?: string | null;
    onclose: () => void;
  } = $props();
</script>

<Modal {title} {onclose}>
  {#if error}
    <p class="text-danger text-sm">{error}</p>
  {:else if loading}
    <ul class="flex flex-col gap-3">
      {#each { length: 4 } as _, i (i)}
        <li class="flex items-center gap-3">
          <div class="skeleton h-16 w-11 shrink-0 rounded"></div>
          <div class="flex-1 space-y-2">
            <div class="skeleton h-3.5 w-3/4 rounded"></div>
            <div class="skeleton h-3 w-1/3 rounded"></div>
          </div>
        </li>
      {/each}
    </ul>
  {:else if works.length === 0}
    <p class="text-dim text-sm">Rien pour l'instant.</p>
  {:else}
    <ul class="flex max-h-96 flex-col gap-1 overflow-y-auto">
      {#each works as w (w.href)}
        <li>
          <a
            href={w.href}
            class="hover:bg-surface-2 flex items-center gap-3 rounded-lg p-2">
            <Poster src={w.imageUrl} title={w.title} class="w-11! rounded" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold"
                >{w.title}</span>
              <span class="text-dim text-xs"
                >{STATS_DOMAIN_LABEL[w.domain]}{#if w.rating !== null}
                  &nbsp;· {w.rating}/10{/if}</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</Modal>
