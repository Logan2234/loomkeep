<script lang="ts">
  import { keys } from "#lib/api/keys.js";
  import { getEditableLists } from "#lib/api/lists.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { listShareable, matchingTitle } from "#lib/chat/attachments.js";
  import {
    LIST_VISIBILITY_LABEL,
    workCountLabel,
  } from "#lib/constants/list-labels.js";
  import Icon from "#lib/components/Icon.svelte";
  import ListCoverGrid from "#lib/components/ListCoverGrid.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { MyListDto } from "@loomkeep/shared";
  import ChatPicker from "./ChatPicker.svelte";

  let {
    query,
    peerName,
    onpick,
    oncancel,
  }: {
    /** What follows `/list `. */
    query: string;
    peerName: string;
    onpick: (list: MyListDto) => void;
    oncancel: () => void;
  } = $props();

  const listsQuery = createApiQuery(() => ({
    key: keys.lists.editable(),
    fetch: getEditableLists,
  }));
  const lists = $derived(
    (listsQuery.data ?? []).filter((list) => matchingTitle(list.title, query)),
  );

  let picker = $state<{ handleKey: (event: KeyboardEvent) => boolean } | null>(
    null,
  );

  export function handleKey(event: KeyboardEvent): boolean {
    return picker?.handleKey(event) ?? false;
  }
</script>

<ChatPicker
  bind:this={picker}
  items={lists}
  key={(list) => list.id}
  label={m.chat_list_picker()}
  title={m.chat_list_picker()}
  empty={listsQuery.loading ? m.common_loading() : m.chat_list_empty()}
  disabled={(list) => !listShareable(list)}
  {onpick}
  {oncancel}>
  {#snippet row(list)}
    <span class="w-[26px] shrink-0 overflow-hidden rounded">
      <ListCoverGrid images={list.previewImageUrls} title={list.title} />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-semibold">{list.title}</span>
      <span class="text-dim block truncate text-xs">
        {listShareable(list)
          ? `${workCountLabel(list.itemCount)}${list.kind === "RANKED" ? ` · ${m.lists_kind_ranked()}` : ""}`
          : m.chat_list_private({ name: peerName })}
      </span>
    </span>
    <span
      class="text-dim flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-bold
        {listShareable(list) ? 'bg-surface-2' : 'border-border border'}">
      {#if !listShareable(list)}<Icon name="lock" class="h-3 w-3" />{/if}
      {LIST_VISIBILITY_LABEL[list.visibility]}
    </span>
  {/snippet}
</ChatPicker>
