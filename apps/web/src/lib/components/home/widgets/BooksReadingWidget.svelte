<script lang="ts">
  import { listBooks } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import type { BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    BookEntryDto,
    HomeWidgetDto,
    HomeWidgetSort,
  } from "@loomkeep/shared";
  import PosterRail from "../PosterRail.svelte";
  import WidgetShell from "../WidgetShell.svelte";
  import { ENTRY_SORTS } from "./sorts";

  let { widget, size }: { widget: HomeWidgetDto; size: BoxSize } = $props();

  const def = HOME_WIDGETS.booksReading;
  const SORTS: Partial<Record<HomeWidgetSort, string>> = {
    ...ENTRY_SORTS,
    progress: "progress",
  };

  const sort = $derived(widget.config?.sort ?? "recent");
  const booksQuery = createApiQuery(() => ({
    key: keys.books.reading(sort),
    fetch: () =>
      listBooks({
        statuses: ["READING"],
        sort: SORTS[sort],
      }).then((r) => r.items),
    enabled: !!auth.user,
  }));

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
  <!-- The other way round from the video widgets: a list by default (the
       page matters more than the cover), covers side by side only once the
       widget is wide enough for several. -->
  <PosterRail
    items={booksQuery.data ?? []}
    keyOf={(e) => e.id}
    label={def.title()}
    info={(e) => ({
      href: `/app/books/${e.book.sourceId}`,
      title: e.book.title,
      imageUrl: e.book.coverUrl,
      subtitle: pages(e),
    })}
    {size}
    metaHeight={26}
    stripMinWidth={480}
    loading={booksQuery.loading}
    empty={m.home_nothing_reading()}>
    {#snippet meta(e)}
      {@const p = pct(e)}
      {#if p !== null}
        <ProgressBar
          value={p}
          label={m.common_selection_summary({
            label: m.book_reading_progress(),
            selection: e.book.title,
          })}
          height="h-1"
          class="mt-1" />
      {/if}
      <p class="timecode mt-0.5 truncate text-[0.65rem]">{pages(e)}</p>
    {/snippet}
  </PosterRail>
</WidgetShell>
