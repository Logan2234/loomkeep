<script lang="ts">
  import { getCastDetail } from "$lib/api/client";
  import Carousel from "$lib/components/Carousel.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { CastDetailDto, CastMemberDto } from "@loomkeep/shared";

  let { cast, source }: { cast: CastMemberDto[]; source: "anilist" | "tmdb" } =
    $props();

  // Cast modal: the clicked member (for the header shown immediately) plus its
  // lazily-loaded detail. Only members with an id are clickable (TMDB persons).
  let castMember = $state<CastMemberDto | null>(null);
  let castDetail = $state<CastDetailDto | null>(null);
  let castLoading = $state(false);

  function openCast(member: CastMemberDto) {
    if (!member.id) return;
    castMember = member;
    castDetail = null;
    castLoading = true;
    getCastDetail(source, member.id)
      .then((d) => (castDetail = d))
      .catch(() => {})
      .finally(() => (castLoading = false));
  }

  function closeCast() {
    castMember = null;
    castDetail = null;
  }
</script>

<svelte:window
  onkeydown={(e) => e.key === "Escape" && castMember && closeCast()} />

{#snippet castCard(c: CastMemberDto, clickable: boolean)}
  <div
    class="bg-surface-2 aspect-2/3 w-full overflow-hidden rounded-lg border border-transparent {clickable
      ? 'group-hover/cast:border-accent transition-colors'
      : ''}">
    {#if c.photoUrl}
      <img
        src={c.photoUrl}
        alt={c.name}
        loading="lazy"
        class="h-full w-full object-cover" />
    {/if}
  </div>
  <p
    class="mt-1.5 truncate text-xs font-semibold {clickable
      ? 'group-hover/cast:text-accent'
      : ''}">
    {c.name}
  </p>
  {#if c.role}
    <p class="text-dim truncate text-[0.65rem]">{c.role}</p>
  {/if}
{/snippet}

{#if cast.length > 0}
  <section class="mt-10">
    <h2 class="font-display mb-3 text-xl font-bold">Distribution</h2>
    <Carousel items={cast} keyOf={(c) => c.name + (c.role ?? "")} gap="gap-3">
      {#snippet card(c)}
        {#if c.id}
          <button
            type="button"
            onclick={() => openCast(c)}
            class="group/cast w-24 text-center">
            {@render castCard(c, true)}
          </button>
        {:else}
          <div class="w-24 shrink-0 snap-start text-center">
            {@render castCard(c, false)}
          </div>
        {/if}
      {/snippet}
    </Carousel>
  </section>
{/if}

<!-- Cast detail modal (TMDB person), lazily loaded on click. -->
{#if castMember}
  <div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
    <button
      class="absolute inset-0 cursor-default bg-black/60"
      aria-label={m.common_close()}
      onclick={closeCast}></button>
    <div
      role="dialog"
      aria-modal="true"
      class="card relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl">
      <button
        class="text-dim hover:bg-surface-2 hover:text-fg absolute top-3 right-3 rounded-full p-1.5"
        aria-label={m.common_close()}
        onclick={closeCast}>
        <Icon name="x" class="h-5 w-5" />
      </button>

      <div class="flex gap-4">
        <div
          class="bg-surface-2 aspect-2/3 w-24 shrink-0 overflow-hidden rounded-lg">
          {#if castDetail?.photoUrl ?? castMember.photoUrl}
            <img
              src={castDetail?.photoUrl ?? castMember.photoUrl}
              alt={castMember.name}
              class="h-full w-full object-cover" />
          {/if}
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="font-display text-xl font-bold text-balance">
            {castMember.name}
          </h3>
          {#if castMember.role}
            <p class="text-dim text-sm">{castMember.role}</p>
          {/if}
          {#if castDetail?.subtitle}
            <p class="timecode mt-1 text-xs">{castDetail.subtitle}</p>
          {/if}
        </div>
      </div>

      {#if castLoading}
        <div class="mt-4 flex flex-col gap-2">
          <div class="skeleton h-3 w-full rounded"></div>
          <div class="skeleton h-3 w-full rounded"></div>
          <div class="skeleton h-3 w-2/3 rounded"></div>
        </div>
      {:else if castDetail}
        {#if castDetail.imdbId || castDetail.wikidataId || castDetail.homepage}
          <div class="mt-4 flex flex-wrap gap-2">
            {#if castDetail.homepage}
              <a
                href={castDetail.homepage}
                target="_blank"
                rel="noopener noreferrer"
                class="border-border text-dim hover:border-accent hover:text-accent rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
                >Site officiel ↗</a>
            {/if}
            {#if castDetail.imdbId}
              <a
                href={`https://www.imdb.com/name/${castDetail.imdbId}/`}
                target="_blank"
                rel="noopener noreferrer"
                class="border-border text-dim hover:border-accent hover:text-accent rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
                >IMDb ↗</a>
            {/if}
            {#if castDetail.wikidataId}
              <a
                href={`https://www.wikidata.org/wiki/${castDetail.wikidataId}`}
                target="_blank"
                rel="noopener noreferrer"
                class="border-border text-dim hover:border-accent hover:text-accent rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
                >Wikidata ↗</a>
            {/if}
          </div>
        {/if}
        {#if castDetail.description}
          <p
            class="text-fg/90 mt-4 text-sm leading-relaxed whitespace-pre-line">
            {castDetail.description}
          </p>
        {/if}
        {#if castDetail.knownFor.length > 0}
          <h4 class="font-display mt-5 mb-2 text-sm font-bold">Connu pour</h4>
          <Carousel
            items={castDetail.knownFor}
            keyOf={(k) => `${k.source}:${k.sourceId}`}
            gap="gap-3"
            wrapClass="-mx-1"
            innerClass="px-1 pb-1"
            snapPad="scroll-pl-1">
            {#snippet card(k)}
              <a
                href={`/app/media/${k.type.toLowerCase()}/${k.sourceId}`}
                onclick={closeCast}
                class="block w-20">
                <div
                  class="card hover:border-accent overflow-hidden transition-[border-color]">
                  <Poster src={k.posterUrl} title={k.title} />
                </div>
                <p class="mt-1 truncate text-[0.65rem] font-semibold">
                  {k.title}
                </p>
              </a>
            {/snippet}
          </Carousel>
        {/if}
      {/if}
    </div>
  </div>
{/if}
