<script lang="ts">
  // "Livres — en détail" section of /stats. Self-contained: fetches on
  // mount, reuses the BOOKS status breakdown already loaded by the overview
  // for "Lus", same pattern as the Vidéo/Jeux sections.
  import { getBookStats } from "$lib/api/stats";
  import type {
    BookStatsDto,
    DomainStatusBreakdownDto,
  } from "@loomkeep/shared";
  import RankBars from "./RankBars.svelte";
  import { statsResource } from "./stats-resource.svelte";
  import StatTile from "./StatTile.svelte";

  let {
    bookBreakdown,
  }: { bookBreakdown: DomainStatusBreakdownDto | undefined } = $props();

  const bookStats = statsResource<BookStatsDto>(
    getBookStats,
    "Statistiques livres indisponibles",
  );
  const books = $derived(bookStats.data);
  const error = $derived(bookStats.error);

  const readCount = $derived(
    bookBreakdown?.byStatus.find((s) => s.bucket === "DONE")?.count ?? 0,
  );

  const nf = new Intl.NumberFormat("fr-FR");

  const authorItems = $derived(
    books
      ? books.topAuthorsByPages.map((a) => ({
          label: a.author,
          value: a.pages,
        }))
      : [],
  );
</script>

{#if error}
  <p class="text-danger text-sm">{error}</p>
{:else if books}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <StatTile value={nf.format(books.pagesRead)} label="Pages lues" />
    <StatTile
      value={readCount}
      label="Lus"
      hint={books.avgPagesPerRead !== null
        ? `moy. ${books.avgPagesPerRead} pages`
        : undefined} />
    <StatTile
      value={books.stagnantInProgressCount}
      label="En lecture stagnants" />
    <StatTile value={books.rereadsCount} label="Relectures" />
  </div>

  <section class="card mt-5 p-5">
    <div class="mb-4 flex items-baseline justify-between">
      <h3 class="font-display text-lg font-bold">Auteurs les plus lus</h3>
      <span class="text-dim text-xs"
        >{books.distinctAuthorsCount} auteurs distincts</span>
    </div>
    {#if authorItems.length > 0}
      <RankBars items={authorItems} />
    {:else}
      <p class="text-dim text-sm">Pas encore de pages lues.</p>
    {/if}
    {#if books.longestBook || books.shortestBook}
      <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
        {#if books.longestBook}
          <a href={books.longestBook.href} class="hover:text-accent">
            <span class="text-dim block uppercase">Livre le + long</span>
            <span class="truncate font-semibold"
              >{books.longestBook.title}</span>
            <span class="timecode block">{books.longestBook.pages} p.</span>
          </a>
        {/if}
        {#if books.shortestBook}
          <a href={books.shortestBook.href} class="hover:text-accent">
            <span class="text-dim block uppercase">Livre le + court</span>
            <span class="truncate font-semibold"
              >{books.shortestBook.title}</span>
            <span class="timecode block">{books.shortestBook.pages} p.</span>
          </a>
        {/if}
      </div>
    {/if}
  </section>
{/if}
