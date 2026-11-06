<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { getBookStats } from "#lib/api/stats.js";
  import { formatNumber } from "#lib/format.js";
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

  const authorItems = $derived(
    books
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
      <div class="inset-card p-4">
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
      value={books.pausedInProgressCount}
      label={m.stats_books_paused()} />
    <StatTile value={books.rereadsCount} label={m.book_rereads()} />
  </div>

  <PremiumTeaser {locked} class="mt-5 block">
    <section class="inset-card p-5">
      <div class="mb-4 flex items-baseline justify-between">
        <h3 class="font-display text-lg font-bold">
          {m.stats_books_top_authors()}
        </h3>
        <span class="text-dim text-xs"
          >{books.distinctAuthorsCount === 1
            ? m.stats_distinct_author({ count: 1 })
            : m.stats_distinct_authors({
                count: books.distinctAuthorsCount,
              })}</span>
      </div>
      {#if authorItems.length > 0}
        <RankBars items={authorItems} />
      {:else}
        <p class="text-dim text-sm">{m.stats_books_no_pages()}</p>
      {/if}
      {#if books.longestBook || books.shortestBook}
        {@const longestBook = books.longestBook}
        {@const shortestBook = books.shortestBook}
        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          {#if longestBook}
            <a href={longestBook.href} class="hover:text-accent">
              <span class="text-dim block uppercase"
                >{m.stats_books_longest()}</span>
              <span class="truncate font-semibold">{longestBook.title}</span>
              <span class="timecode block"
                >{longestBook.pages} {m.book_page_short()}</span>
            </a>
          {/if}
          {#if shortestBook}
            <a href={shortestBook.href} class="hover:text-accent">
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
