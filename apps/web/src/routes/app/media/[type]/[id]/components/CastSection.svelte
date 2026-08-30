<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import { getCastDetail } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Carousel from "$lib/components/Carousel.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import type { CastMemberDto } from "@loomkeep/shared";

  let { cast, source }: { cast: CastMemberDto[]; source: "anilist" | "tmdb" } =
    $props();

  // Cast modal: the clicked member (for the header shown immediately) plus its
  // lazily-loaded detail. Only members with an id are clickable (TMDB persons).
  let castMember = $state<CastMemberDto | null>(null);

  const castQuery = createApiQuery(() => ({
    key: keys.catalog.castDetail(source, castMember?.id ?? ""),
    fetch: () => getCastDetail(source, castMember!.id!),
    enabled: castMember?.id !== undefined,
  }));
  const castDetail = $derived(castQuery.data);
  const castLoading = $derived(castQuery.loading);

  function openCast(member: CastMemberDto) {
    if (!member.id) return;
    castMember = member;
  }

  function closeCast() {
    castMember = null;
  }
</script>

<svelte:window
  onkeydown={(e) => e.key === "Escape" && castMember && closeCast()} />

{#snippet castCard(c: CastMemberDto, clickable: boolean)}
  <div
    class="bg-surface-2 aspect-2/3 w-full overflow-hidden rounded-lg border border-transparent {clickable
      ? 'group-hover/cast:border-accent transition-colors'
      : ''}">
    {#if c.characterPhotoUrl}
      <!-- Voice actor (left) / character (right), split down the middle. -->
      <div class="flex h-full w-full">
        <img
          src={c.photoUrl}
          alt={c.name}
          loading="lazy"
          class="h-full w-1/2 object-cover" />
        <img
          src={c.characterPhotoUrl}
          alt={c.role ?? ""}
          loading="lazy"
          class="h-full w-1/2 object-cover" />
      </div>
    {:else if c.photoUrl}
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
    <h2 class="font-display mb-3 text-xl font-bold">{m.media_cast()}</h2>
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
  <Modal onclose={closeCast} title="" wide>
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
              >{m.media_official_site()}</a>
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
        <p class="text-fg/90 mt-4 text-sm leading-relaxed whitespace-pre-line">
          {castDetail.description}
        </p>
      {/if}
      {#if castDetail.knownFor.length > 0}
        <h4 class="font-display mt-5 mb-2 text-sm font-bold">
          {m.media_known_for()}
        </h4>
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
  </Modal>
{/if}
