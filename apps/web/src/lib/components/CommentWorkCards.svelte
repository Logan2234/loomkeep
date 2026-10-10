<script lang="ts">
  // The works a comment links to, as cards under it: what Messages makes of
  // a link, read here when the comment shows (comments keep no cards).
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import {
    MAX_LINKED_WORKS,
    MAX_SCANNED_LINKS,
    previewLinkedWork,
    typedLinks,
  } from "#lib/chat/work-search.js";
  import type { MessageWorkDto } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import ChatWorkCard from "./chat/ChatWorkCard.svelte";

  let { text }: { text: string } = $props();

  const queryClient = useQueryClient();
  const links = $derived(typedLinks(text).slice(0, MAX_SCANNED_LINKS));

  const cardsQuery = createApiQuery(() => ({
    key: keys.chat.linkPreviews(links),
    // One cache entry per link, shared with the composer's previews.
    fetch: () =>
      Promise.all(
        links.map((url) =>
          queryClient.ensureQueryData({
            queryKey: keys.chat.linkPreview(url),
            queryFn: () => previewLinkedWork(url).catch(() => null),
          }),
        ),
      ),
    enabled: links.length > 0,
  }));

  const works = $derived(
    (cardsQuery.data ?? [])
      .filter((work): work is MessageWorkDto => work !== null)
      .filter(
        (work, index, all) =>
          all.findIndex((other) => other.href === work.href) === index,
      )
      .slice(0, MAX_LINKED_WORKS),
  );
</script>

{#if works.length > 0}
  <div class="mt-2 flex flex-wrap gap-2">
    {#each works as work (work.href)}
      <ChatWorkCard {work} />
    {/each}
  </div>
{/if}
