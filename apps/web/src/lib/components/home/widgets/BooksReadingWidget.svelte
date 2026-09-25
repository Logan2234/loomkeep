<script lang="ts">
  import { listBooks } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { bodyOf, posterLayout, type BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type { BookEntryDto } from "@loomkeep/shared";
  import PosterRail from "../PosterRail.svelte";
  import WidgetShell from "../WidgetShell.svelte";

  let { size }: { size: BoxSize } = $props();

  const def = HOME_WIDGETS.booksReading;

  const booksQuery = createApiQuery(() => ({
    key: keys.books.reading(),
    fetch: () => listBooks({ statuses: ["READING"] }).then((r) => r.items),
    enabled: !!auth.user,
  }));

  // The other way round from the video widgets: a list by default (a book is
  // read one page at a time, the page matters more than the cover), covers
  // side by side only once the widget is wide enough for several.
  const layout = $derived.by(() => {
    const body = bodyOf(size);
    return body.width >= 480
      ? posterLayout(body, { meta: 26 })
      : posterLayout({ ...body, width: 0 });
  });

  function pct(e: BookEntryDto): number | null {
    if (!e.book.pageCount) return null;
    return Math.round((e.currentPage / e.book.pageCount) * 100);
  }
  const pages = (e: BookEntryDto) =>
    e.book.pageCount
      ? `${m.book_page_short()} ${e.currentPage} / ${e.book.pageCount}`
      : `${m.book_page_short()} ${e.currentPage}`;
</script>

<WidgetShell icon={def.icon} title={def.title()} href="/app/books">
  <PosterRail
    items={booksQuery.data ?? []}
    keyOf={(e) => e.id}
    info={(e) => ({
      href: `/app/books/${e.book.sourceId}`,
      title: e.book.title,
      imageUrl: e.book.coverUrl,
      subtitle: pages(e),
    })}
    {layout}
    loading={booksQuery.loading}
    empty={m.home_nothing_reading()}>
    {#snippet meta(e)}
      {@const p = pct(e)}
      {#if p !== null}
        <ProgressBar value={p} height="h-1" class="mt-1" />
      {/if}
      <p class="timecode mt-0.5 truncate text-[0.65rem]">{pages(e)}</p>
    {/snippet}
  </PosterRail>
</WidgetShell>
