<script lang="ts">
  // "Œuvres partagées": every work a conversation passed around, once each,
  // last shared first — straight from the cards its messages keep.
  import { getConversationWorks } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Modal from "#lib/components/Modal.svelte";
  import { formatDate } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { ConversationWorkDto } from "@loomkeep/shared";
  import ChatSharedWorkRow from "./ChatSharedWorkRow.svelte";

  let {
    conversationId,
    peerName,
    onclose,
  }: {
    conversationId: string;
    peerName: string;
    onclose: () => void;
  } = $props();

  const worksQuery = createApiQuery(() => ({
    key: keys.chat.works(conversationId),
    fetch: () => getConversationWorks(conversationId),
  }));

  // A ledger by month of sharing, latest first as the list comes.
  const months = $derived.by(() => {
    const out: { label: string; works: ConversationWorkDto[] }[] = [];
    for (const work of worksQuery.data ?? []) {
      const label = formatDate(work.sharedAt, {
        month: "long",
        year: "numeric",
      });
      const last = out.at(-1);
      if (last?.label === label) last.works.push(work);
      else out.push({ label, works: [work] });
    }
    return out;
  });
</script>

<Modal title={m.chat_shared_works()} {onclose}>
  {#if worksQuery.data && worksQuery.data.length > 0}
    <div class="flex flex-col">
      {#each months as month (month.label)}
        <h3
          class="text-dim mt-2.5 mb-0.5 flex items-center gap-2 font-mono text-[0.66rem] tracking-widest uppercase first:mt-0">
          {month.label}
          <span class="bg-border h-px flex-1"></span>
        </h3>
        <ul class="flex flex-col">
          {#each month.works as work (work.href)}
            <ChatSharedWorkRow {work} {peerName} />
          {/each}
        </ul>
      {/each}
    </div>
  {:else if worksQuery.loading}
    <ul class="flex flex-col" aria-busy="true">
      {#each [0, 1, 2, 3] as i (i)}
        <li
          class="border-surface-2 flex items-center gap-3 border-b py-2.5 last:border-b-0">
          <span
            class="bg-surface-2 h-[57px] w-[38px] animate-pulse rounded-[5px]"
          ></span>
          <span class="flex flex-1 flex-col gap-2">
            <span class="bg-surface-2 h-3.5 w-36 animate-pulse rounded"></span>
            <span class="bg-surface-2 h-2.5 w-20 animate-pulse rounded"></span>
          </span>
          <span class="bg-surface-2 h-2.5 w-16 animate-pulse rounded"></span>
          <span class="bg-surface-2 h-7 w-7 animate-pulse rounded-full"></span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-dim py-4 text-center text-sm">
      {m.chat_shared_works_empty()}
    </p>
  {/if}
</Modal>
