<script lang="ts">
  import { goBack } from "#lib/back-nav.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { Snippet } from "svelte";

  // The title page's header, shared by every domain (FIC-06): full-bleed
  // image, title and meta overlaid, cover tucked in the corner. Text stays
  // white whatever the theme — it sits on a picture, not on the page.
  let {
    title,
    backdropUrl,
    coverUrl,
    square = false,
    backHref,
    backLabel,
    onTrailer,
    onEnlargeCover,
    onCompactChange,
    pills,
    children,
  }: {
    title: string;
    backdropUrl: string | null;
    coverUrl: string | null;
    /** An album cover: square rather than a poster's 2:3. */
    square?: boolean;
    backHref: string;
    backLabel: string;
    onTrailer?: () => void;
    onEnlargeCover: () => void;
    /** True once the hero has scrolled behind the sticky action bar. */
    onCompactChange?: (compact: boolean) => void;
    pills: Snippet;
    /** Under the title: meta, dates, ratings. */
    children?: Snippet;
  } = $props();

  let heroEnd = $state<HTMLDivElement>();

  $effect(() => {
    const el = heroEnd;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([e]) => onCompactChange?.(!e.isIntersecting),
      { rootMargin: "-65px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  });
</script>

<!-- The 26.25rem floor outgrew short viewports: a phone in landscape
     (~430px tall) got a full-screen backdrop with the tracking controls
     pushed below the fold, so the floor yields to the viewport there. -->
<div
  class="relative flex min-h-[max(min(26.25rem,62svh),min(64vh,38.75rem))] flex-col justify-end overflow-hidden">
  {#if backdropUrl}
    <img
      src={backdropUrl}
      alt=""
      class="absolute inset-0 h-full w-full object-cover" />
  {:else if coverUrl}
    <!-- Books and albums have no backdrop: their cover, blown up and
         blurred, gives the same full-bleed ground. -->
    <img
      src={coverUrl}
      alt=""
      class="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl saturate-150" />
  {:else}
    <div class="from-surface-2 to-surface absolute inset-0 bg-linear-to-br">
    </div>
  {/if}
  <div
    class="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent">
  </div>
  <!-- In the corner on a phone; centred on a desktop, where the alerts bell
       holds the top-right corner. -->
  {#if onTrailer}
    <button
      type="button"
      class="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/55 md:top-[38%] md:right-auto md:left-1/2 md:h-16 md:w-16 md:-translate-x-1/2 md:-translate-y-1/2 md:border-0 md:hover:bg-black/60"
      aria-label={m.media_watch_trailer()}
      title={m.media_watch_trailer()}
      onclick={onTrailer}>
      <Icon name="play" class="pointer-events-none h-5 w-5 md:h-7 md:w-7" />
    </button>
  {/if}
  <a
    href={backHref}
    onclick={goBack}
    class="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur hover:bg-black/55">
    ← {backLabel}
  </a>

  {#if coverUrl}
    <button
      type="button"
      class="absolute right-4 bottom-4 z-10 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-white/20 shadow-lg md:right-6 md:bottom-6 {square
        ? 'w-18 sm:w-22 md:w-28'
        : 'w-16 sm:w-20 md:w-24'}"
      aria-label={m.media_enlarge_poster()}
      onclick={onEnlargeCover}
      data-detail-poster>
      {#if square}
        <img src={coverUrl} alt="" class="aspect-square w-full object-cover" />
      {:else}
        <Poster src={coverUrl} {title} alt="" />
      {/if}
    </button>
  {/if}

  <!-- In the flow, so the hero grows with a long title or an enlarged system
       font instead of pushing them out through its top. pt clears the back
       link, in rem since that link grows with the system font. Its own gradient keeps every line readable on a bright backdrop
       (a sky), whatever height the text block reaches. -->
  <div
    class="relative w-full bg-[linear-gradient(to_bottom,transparent,rgb(0_0_0/0.6)_4rem,rgb(0_0_0/0.85))] pt-[4rem]">
    <div
      class="mx-auto max-w-5xl px-5 pb-6 md:px-8 md:pb-8 {square
        ? 'pr-24 sm:pr-28 md:pr-8'
        : 'pr-20 sm:pr-24 md:pr-8'}">
      <div class="flex flex-wrap items-center gap-2">
        {@render pills()}
      </div>
      <h1
        class="font-display mt-2 text-3xl font-extrabold tracking-tight text-balance text-white text-shadow-[0_2px_24px_rgba(0,0,0,.5)] md:text-4xl">
        {title}
      </h1>
      {@render children?.()}
    </div>
  </div>
</div>

<div bind:this={heroEnd}></div>
