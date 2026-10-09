<script lang="ts">
  // "Œuvres partagées": every work a conversation passed around, once each,
  // last shared first — straight from the cards its messages keep.
  import { getConversationWorks } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Modal from "#lib/components/Modal.svelte";
  import { formatDate } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import ChatWorkCard from "./ChatWorkCard.svelte";

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
</script>

<Modal title={m.chat_shared_works()} {onclose}>
  {#if worksQuery.data && worksQuery.data.length > 0}
    <ul class="flex flex-col gap-3">
      {#each worksQuery.data as work (work.href)}
        <li class="flex flex-col gap-1">
          <ChatWorkCard {work} />
          <span class="text-dim px-1 font-mono text-[0.65rem]">
            {m.chat_shared_by({
              name: work.mine ? m.common_you() : peerName,
              date: formatDate(work.sharedAt, {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
              }),
            })}
          </span>
        </li>
      {/each}
    </ul>
  {:else if worksQuery.loading}
    <ul class="flex flex-col gap-3" aria-busy="true">
      {#each [0, 1, 2] as i (i)}
        <li class="flex flex-col gap-1">
          <div
            class="border-border bg-surface flex w-64 max-w-full gap-3 rounded-xl border p-2">
            <div
              class="bg-surface-2 h-[78px] w-[52px] animate-pulse rounded-md">
            </div>
            <div class="flex flex-1 flex-col gap-2 py-1">
              <div class="bg-surface-2 h-2.5 w-16 animate-pulse rounded"></div>
              <div class="bg-surface-2 h-4 w-32 animate-pulse rounded"></div>
            </div>
          </div>
          <div class="bg-surface-2 mx-1 h-2.5 w-36 animate-pulse rounded"></div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-dim py-4 text-center text-sm">
      {m.chat_shared_works_empty()}
    </p>
  {/if}
</Modal>
