<script lang="ts">
  // "Livres — en détail" section of /stats. Self-contained: fetches on
  // mount, reuses the BOOKS status breakdown already loaded by the overview
  // for "Lus", same pattern as the Vidéo/Jeux sections.
  import { getBookStats } from "$lib/api/stats";
  import { formatNumber } from "$lib/format";
  import type {
    BookStatsDto,
    DomainStatusBreakdownDto,
  } from "@loomkeep/shared";
  import PremiumTeaser from "../PremiumTeaser.svelte";
  import RankBars from "./RankBars.svelte";
  import { statsResource } from "./stats-resource.svelte";
  import StatTile from "./StatTile.svelte";

  let {
    bookBreakdown,
    locked,
  }: {
    bookBreakdown: DomainStatusBreakdownDto | undefined;
    locked: boolean;
  } = $props();

  const bookStats = statsResource<BookStatsDto>(getBookStats);
  const books = $derived(bookStats.data);
  const error = $derived(bookStats.error);

  const readCount = $derived(
    bookBreakdown?.byStatus.find((s) => s.bucket === "DONE")?.count ?? 0,
  );

  // Static, made-up previews shown instead of the real (redacted) advanced
  // fields when `locked` — see stats.service.ts's redact* methods and
  // PremiumTeaser's own doc comment.
  const FAKE_AUTHORS = [
    { label: "Un auteur favori", value: 850 },
    { label: "Un autre auteur", value: 420 },
    { label: "Découverte récente", value: 210 },
  ];
  const FAKE_LONGEST_BOOK = { title: "Un pavé mémorable", pages: 820 };
  const FAKE_SHORTEST_BOOK = { title: "Une lecture rapide", pages: 96 };

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

{#if error}
  <p class="text-danger text-sm">{error}</p>
{:else if books}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <StatTile value={formatNumber(books.pagesRead)} label="Pages lues" />
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

  <PremiumTeaser {locked} class="mt-5 block">
    <section class="card p-5">
      <div class="mb-4 flex items-baseline justify-between">
        <h3 class="font-display text-lg font-bold">Auteurs les plus lus</h3>
        <span class="text-dim text-xs"
          >{locked ? 8 : books.distinctAuthorsCount} auteurs distincts</span>
      </div>
      {#if locked || authorItems.length > 0}
        <RankBars items={authorItems} />
      {:else}
        <p class="text-dim text-sm">Pas encore de pages lues.</p>
      {/if}
      {#if locked || books.longestBook || books.shortestBook}
        {@const longestBook = locked ? FAKE_LONGEST_BOOK : books.longestBook}
        {@const shortestBook = locked ? FAKE_SHORTEST_BOOK : books.shortestBook}
        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          {#if longestBook}
            <a
              href={locked ? "#" : books.longestBook?.href}
              class="hover:text-accent">
              <span class="text-dim block uppercase">Livre le + long</span>
              <span class="truncate font-semibold">{longestBook.title}</span>
              <span class="timecode block">{longestBook.pages} p.</span>
            </a>
          {/if}
          {#if shortestBook}
            <a
              href={locked ? "#" : books.shortestBook?.href}
              class="hover:text-accent">
              <span class="text-dim block uppercase">Livre le + court</span>
              <span class="truncate font-semibold">{shortestBook.title}</span>
              <span class="timecode block">{shortestBook.pages} p.</span>
            </a>
          {/if}
        </div>
      {/if}
    </section>
  </PremiumTeaser>
{/if}
