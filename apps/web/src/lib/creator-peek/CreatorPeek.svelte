<script lang="ts">
  // The peek a steady hover on a person's name opens (see peek.svelte.ts):
  // who they are and what they're known for, without leaving the page. It
  // reads the person page's own query, so "See their page" opens it loaded.
  import { afterNavigate } from "$app/navigation";
  import { getPersonPage } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { TOOLTIP_Z_INDEX } from "#lib/components/overlay-layers.js";
  import Poster from "#lib/components/Poster.svelte";
  import { creatorHref } from "#lib/creator-href.js";
  import { joinMeta } from "#lib/format.js";
  import { lifeYears } from "#lib/life-years.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { fade, scale } from "svelte/transition";
  import { peek, peekPanel, type PeekTarget } from "./peek.svelte";
  import { peekPosition } from "./peek-position";
  import { peekWorks } from "./peek-works";

  const reduced = prefersReducedMotion();

  // Kept through the closing fade, after `peek.target` is gone.
  let shown = $state<PeekTarget | null>(null);
  $effect(() => {
    if (peek.open && peek.target) shown = peek.target;
  });

  const loading = $derived(peek.target ?? shown);
  const personQuery = createApiQuery(() => ({
    key: keys.creators.person(loading?.ref.source ?? "", loading?.ref.id ?? ""),
    fetch: () => getPersonPage(loading!.ref.source, loading!.ref.id),
    enabled: !!loading && !!creatorHref(loading.ref),
  }));
  const person = $derived(
    personQuery.data?.id === shown?.ref.id ? personQuery.data : undefined,
  );

  const href = $derived(shown ? creatorHref(shown.ref) : null);
  const photo = $derived(person?.photoUrl ?? shown?.photoUrl ?? null);
  const meta = $derived(
    person
      ? joinMeta(
          lifeYears(person.birthday, person.deathday),
          person.placeOfBirth,
        )
      : null,
  );
  const works = $derived(person ? peekWorks(person) : []);

  let panelWidth = $state(0);
  let panelHeight = $state(0);
  const position = $derived.by(() => {
    if (!shown || !peek.open) return null;
    return peekPosition(
      shown.anchor.getBoundingClientRect(),
      { width: panelWidth, height: panelHeight },
      { width: innerWidth, height: innerHeight },
    );
  });

  afterNavigate(() => peekPanel.close());
</script>

<svelte:window
  onkeydown={(e) => e.key === "Escape" && peek.open && peekPanel.close()}
  onscrollcapture={() => peek.open && peekPanel.close()} />

{#if peek.open && shown && href}
  <div
    role="dialog"
    aria-labelledby="creator-peek-name"
    bind:offsetWidth={panelWidth}
    bind:offsetHeight={panelHeight}
    onpointerenter={() => peekPanel.hold()}
    onpointerleave={(e) => e.pointerType !== "touch" && peekPanel.leave()}
    in:scale={{ duration: reduced ? 0 : 200, start: 0.96 }}
    out:fade={{ duration: reduced ? 0 : 150 }}
    style="top: {position?.top ?? 0}px; left: {position?.left ??
      0}px; z-index: {TOOLTIP_Z_INDEX}; transform-origin: {position?.above
      ? 'bottom'
      : 'top'} left;"
    class="border-border bg-surface fixed w-[21rem] max-w-[calc(100vw-1rem)] rounded-xl border p-3.5 shadow-xl">
    <div class="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-3">
      <div
        class="bg-surface-2 aspect-2/3 overflow-hidden rounded-lg"
        data-creator-portrait>
        {#if photo}
          <img src={photo} alt="" class="h-full w-full object-cover" />
        {/if}
      </div>
      <div class="min-w-0">
        {#if shown.role}
          <p class="text-dim truncate text-xs">{shown.role}</p>
        {/if}
        <p
          id="creator-peek-name"
          class="font-display text-lg leading-tight font-bold text-balance">
          {shown.ref.name}
        </p>
        {#if meta}
          <p class="timecode mt-1 text-xs">{meta}</p>
        {/if}
      </div>
    </div>

    {#if person?.description}
      <p class="text-dim mt-3 line-clamp-3 text-sm">{person.description}</p>
    {:else if !person}
      <div class="mt-3 flex flex-col gap-1.5" aria-hidden="true">
        <div class="skeleton h-3 w-full rounded"></div>
        <div class="skeleton h-3 w-5/6 rounded"></div>
      </div>
    {/if}

    {#if works.length > 0}
      <p class="timecode mt-3 text-xs">{m.media_known_for()}</p>
      <ul class="mt-1.5 grid grid-cols-4 gap-1.5">
        {#each works as work (`${work.type}:${work.sourceId}`)}
          <li>
            <a
              href={`/app/media/${work.type.toLowerCase()}/${work.sourceId}`}
              aria-label={work.title}
              class="hover:border-accent block overflow-hidden rounded-md border border-transparent transition-colors">
              <Poster src={work.posterUrl} title={work.title} alt="" />
            </a>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="mt-3 flex justify-end">
      <a {href} class="btn btn-primary">{m.creator_see_page()}</a>
    </div>
  </div>
{/if}
