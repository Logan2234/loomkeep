<script lang="ts">
  // The "Œuvres" tab as a list: the sheet's and the full-screen page's.
  import { getWorkThreads } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import type { WorkThreadRef } from "#lib/chat/chat.svelte.js";
  import ChatWorksEmpty from "./ChatWorksEmpty.svelte";
  import ChatWorkRow from "./ChatWorkRow.svelte";

  let {
    active = null,
    onselect,
  }: {
    active?: WorkThreadRef | null;
    onselect: (work: WorkThreadRef) => void;
  } = $props();

  const threadsQuery = createApiQuery(() => ({
    key: keys.chat.workThreads(),
    fetch: getWorkThreads,
  }));
  const threads = $derived(threadsQuery.data ?? []);
</script>

{#if threadsQuery.loading}
  <div class="flex flex-col gap-1 px-2" aria-hidden="true">
    {#each [0, 1, 2, 3] as row (row)}
      <div class="flex items-center gap-3 px-3 py-2">
        <span class="bg-surface-2 h-[54px] w-9 animate-pulse rounded-md"></span>
        <span class="flex flex-1 flex-col gap-2">
          <span class="bg-surface-2 h-3 w-2/3 animate-pulse rounded"></span>
          <span class="bg-surface-2 h-2.5 w-full animate-pulse rounded"></span>
        </span>
      </div>
    {/each}
  </div>
{:else if threads.length === 0}
  <ChatWorksEmpty />
{:else}
  <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2">
    {#each threads as thread (`${thread.targetType}:${thread.targetId}`)}
      <ChatWorkRow
        {thread}
        active={active?.targetType === thread.targetType &&
          active.targetId === thread.targetId}
        onselect={(t) =>
          onselect({ targetType: t.targetType, targetId: t.targetId })} />
    {/each}
  </div>
{/if}
