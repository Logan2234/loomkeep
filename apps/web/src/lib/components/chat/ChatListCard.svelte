<script lang="ts">
  import { chat } from "#lib/chat/chat.svelte.js";
  import { LIST_VISIBILITY_LABEL } from "#lib/constants/list-labels.js";
  import Poster from "#lib/components/Poster.svelte";
  import { formatDate } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import { MESSAGE_LIST_WORKS, type MessageListDto } from "@loomkeep/shared";

  let { list }: { list: MessageListDto } = $props();

  const ranked = $derived(list.kind === "RANKED");
  // Five slots: the first five works, or four and what's left counted.
  const overflow = $derived(list.itemCount > MESSAGE_LIST_WORKS);
  const shown = $derived(
    overflow ? list.works.slice(0, MESSAGE_LIST_WORKS - 1) : list.works,
  );
</script>

<!-- A film strip of the list's first works, numbered when it's a ranking. -->
<a
  href="/app/lists/{list.id}"
  class="border-border bg-surface text-fg hover:border-accent flex w-72 max-w-full flex-col gap-2 rounded-2xl border p-3 no-underline transition-[border-color,transform] duration-150 hover:-translate-y-px motion-reduce:transition-none"
  onclick={() => chat.close()}>
  <span class="flex items-center justify-between gap-2">
    <span
      class="text-accent font-mono text-[0.62rem] font-bold tracking-wider uppercase">
      {ranked ? m.chat_list_ranked() : m.chat_list_collection()} · {list.itemCount}
    </span>
    <span
      class="bg-surface-2 text-dim rounded-full px-2 py-0.5 text-[0.7rem] font-bold">
      {LIST_VISIBILITY_LABEL[list.visibility]}
    </span>
  </span>
  <span class="font-display text-[1.05rem] leading-tight font-extrabold">
    {list.title}
  </span>
  {#if list.works.length > 0}
    <span class="grid grid-cols-5 gap-1.5">
      {#each shown as work, i (i)}
        <span class="relative overflow-hidden rounded-md">
          <Poster
            src={work.imageUrl}
            title={work.title}
            alt=""
            caption={false} />
          {#if ranked}
            <span
              class="bg-accent text-accent-fg absolute top-1 left-1 rounded px-1 font-mono text-[0.62rem] font-bold">
              {i + 1}
            </span>
          {/if}
        </span>
      {/each}
      {#if overflow}
        <span
          class="bg-surface-2 text-dim grid aspect-2/3 place-items-center rounded-md font-mono text-xs font-bold">
          +{list.itemCount - shown.length}
        </span>
      {/if}
    </span>
  {/if}
  <span class="text-dim font-mono text-[0.68rem]">
    {m.chat_list_footer({
      by: list.mine
        ? m.chat_list_by_you()
        : m.chat_list_by({ name: list.ownerName }),
      date: formatDate(list.updatedAt, { day: "2-digit", month: "2-digit" }),
    })}
  </span>
</a>
