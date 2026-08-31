<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  // "Livres — en détail" section of /stats. Self-contained: fetches on
  // mount, reuses the BOOKS status breakdown already loaded by the overview
  // for "Lus", same pattern as the Vidéo/Jeux sections.
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { getBookStats } from "$lib/api/stats";
  import { formatNumber } from "$lib/format";
  import type { DomainStatusBreakdownDto } from "@loomkeep/shared";
  import PremiumTeaser from "../PremiumTeaser.svelte";
  import RankBars from "./RankBars.svelte";
  import StatTile from "./StatTile.svelte";

  let {
    bookBreakdown,
    locked,
  }: {
    bookBreakdown: DomainStatusBreakdownDto | undefined;
    locked: boolean;
  } = $props();

  const bookStats = createApiQuery(() => ({
    key: keys.stats.books(),
    fetch: getBookStats,
  }));
  const books = $derived(bookStats.data);
  const error = $derived(bookStats.error);
  const loading = $derived(bookStats.loading);

  const readCount = $derived(
    bookBreakdown?.byStatus.find((s) => s.bucket === "DONE")?.count ?? 0,
  );

  // Static, made-up previews shown instead of the real (redacted) advanced
  // fields when `locked` — see stats.service.ts's redact* methods and
  // PremiumTeaser's own doc comment.
  const FAKE_AUTHORS = [
    { label: m.stats_preview_author(), value: 850 },
    { label: m.stats_preview_other_author(), value: 420 },
    { label: m.stats_preview_recent(), value: 210 },
  ];
  const FAKE_LONGEST_BOOK = { title: m.stats_preview_long_book(), pages: 820 };
  const FAKE_SHORTEST_BOOK = { title: m.stats_preview_short_book(), pages: 96 };

  const authorItems = $derived(
    locked
      ? FAKE_AUTHORS
      : books
        ? books.topAuthorsByPages.map((a) => ({
            label: a.author,
            value: a.pages,
          }))
        : [],
  );
</script>

{#if loading}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {#each { length: 4 } as _, i (i)}
      <div class="card p-4">
        <div class="skeleton h-8 w-1/2 rounded"></div>
        <div class="skeleton mt-2 h-3 w-2/3 rounded"></div>
      </div>
    {/each}
  </div>
{:else if error}
  <p class="text-danger text-sm">{error}</p>
{:else if books}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <StatTile
      value={formatNumber(books.pagesRead)}
      label={m.stats_books_pages_read()} />
    <StatTile
      value={readCount}
      label={m.stats_books_read()}
      hint={books.avgPagesPerRead !== null
        ? books.avgPagesPerRead === 1
          ? m.stats_books_average_page({
              pages: formatNumber(books.avgPagesPerRead),
            })
          : m.stats_books_average_pages({
              pages: formatNumber(books.avgPagesPerRead),
            })
        : undefined} />
    <StatTile
      value={books.stagnantInProgressCount}
      label={m.stats_books_stagnant()} />
    <StatTile value={books.rereadsCount} label={m.book_rereads()} />
  </div>

  <PremiumTeaser {locked} class="mt-5 block">
    <section class="card p-5">
      <div class="mb-4 flex items-baseline justify-between">
        <h3 class="font-display text-lg font-bold">
          {m.stats_books_top_authors()}
        </h3>
        <span class="text-dim text-xs"
          >{!locked && books.distinctAuthorsCount === 1
            ? m.stats_distinct_author({ count: 1 })
            : m.stats_distinct_authors({
                count: locked ? 8 : books.distinctAuthorsCount,
              })}</span>
      </div>
      {#if locked || authorItems.length > 0}
        <RankBars items={authorItems} />
      {:else}
        <p class="text-dim text-sm">{m.stats_books_no_pages()}</p>
      {/if}
      {#if locked || books.longestBook || books.shortestBook}
        {@const longestBook = locked ? FAKE_LONGEST_BOOK : books.longestBook}
        {@const shortestBook = locked ? FAKE_SHORTEST_BOOK : books.shortestBook}
        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          {#if longestBook}
            <a
              href={locked ? "#" : books.longestBook?.href}
              class="hover:text-accent">
              <span class="text-dim block uppercase"
                >{m.stats_books_longest()}</span>
              <span class="truncate font-semibold">{longestBook.title}</span>
              <span class="timecode block"
                >{longestBook.pages} {m.book_page_short()}</span>
            </a>
          {/if}
          {#if shortestBook}
            <a
              href={locked ? "#" : books.shortestBook?.href}
              class="hover:text-accent">
              <span class="text-dim block uppercase"
                >{m.stats_books_shortest()}</span>
              <span class="truncate font-semibold">{shortestBook.title}</span>
              <span class="timecode block"
                >{shortestBook.pages} {m.book_page_short()}</span>
            </a>
          {/if}
        </div>
      {/if}
    </section>
  </PremiumTeaser>
{/if}
