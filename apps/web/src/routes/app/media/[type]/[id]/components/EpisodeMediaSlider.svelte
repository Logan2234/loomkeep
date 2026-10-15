<script lang="ts">
  import Icon from "#lib/components/Icon.svelte";
  import Lightbox from "#lib/components/Lightbox.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { fade } from "svelte/transition";
  import { videoThumbnail } from "./episodes";

  let {
    images,
    videos,
    alt,
    caption,
    overlay,
  }: {
    /** Stills, the main one first. */
    images: string[];
    /** YouTube videos (trailers, clips). */
    videos: { key: string; type: string }[];
    alt: string;
    /** Where the image comes from ("Image · TMDB"). */
    caption: string | null;
    /** Laid over the frame, e.g. "Dans 3 jours". */
    overlay?: string | null;
  } = $props();

  const reduced = prefersReducedMotion();

  // The main still leads, then the videos, then the rest of the gallery.
  type Slide = { kind: "image"; src: string } | { kind: "video"; key: string };
  const slides = $derived<Slide[]>([
    ...images.slice(0, 1).map((src) => ({ kind: "image" as const, src })),
    ...videos.map((v) => ({ kind: "video" as const, key: v.key })),
    ...images.slice(1).map((src) => ({ kind: "image" as const, src })),
  ]);

  let index = $state(0);
  // A new episode (or its gallery arriving) starts over at the main still.
  $effect(() => {
    void images;
    index = 0;
  });
  const current = $derived(slides[Math.min(index, slides.length - 1)]);

  let lightbox = $state<{ video: string | null; index: number } | null>(null);

  function open(slide: Slide) {
    lightbox =
      slide.kind === "video"
        ? { video: slide.key, index: 0 }
        : { video: null, index: Math.max(0, images.indexOf(slide.src)) };
  }

  const step = (delta: number) =>
    (index = (index + delta + slides.length) % slides.length);

  let touchStartX: number | null = null;
  function onTouchEnd(e: TouchEvent) {
    if (touchStartX === null || slides.length < 2) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    // A short tap opens the slide rather than swiping.
    if (Math.abs(delta) > 40) step(delta < 0 ? 1 : -1);
    touchStartX = null;
  }
</script>

<div
  class="bg-surface-2 group relative aspect-video overflow-hidden rounded-xl"
  role="group"
  aria-roledescription="carousel"
  aria-label={m.media_episode_gallery()}
  ontouchstart={(e) => (touchStartX = e.touches[0].clientX)}
  ontouchend={onTouchEnd}>
  {#if current}
    {#key current}
      <button
        type="button"
        class="absolute inset-0 h-full w-full"
        aria-label={current.kind === "video"
          ? m.media_episode_play_video()
          : m.common_image_large()}
        onclick={() => open(current)}
        transition:fade={{ duration: reduced ? 0 : 180 }}>
        <img
          src={current.kind === "video"
            ? videoThumbnail(current.key)
            : current.src}
          {alt}
          class="h-full w-full object-cover" />
        {#if current.kind === "video"}
          <span class="absolute inset-0 grid place-items-center bg-black/25">
            <span
              class="bg-bg/80 text-fg grid h-12 w-12 place-items-center rounded-full transition-transform duration-150 group-hover:scale-105 motion-reduce:transition-none">
              <Icon name="play" class="h-5 w-5" />
            </span>
          </span>
        {/if}
      </button>
    {/key}
  {:else}
    <span class="text-dim/60 absolute inset-0 grid place-items-center">
      <Icon name="tv" class="h-8 w-8" />
    </span>
  {/if}

  {#if overlay}
    <span
      class="timecode bg-bg/65 pointer-events-none absolute inset-0 grid place-items-center text-sm text-white">
      {overlay}
    </span>
  {/if}

  {#if slides.length > 1}
    <button
      type="button"
      class="bg-bg/70 text-fg hover:bg-bg/90 absolute top-1/2 left-2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full opacity-90 transition-colors"
      aria-label={m.common_image_previous()}
      onclick={() => step(-1)}>
      <Icon name="chevron-left" class="h-5 w-5" />
    </button>
    <button
      type="button"
      class="bg-bg/70 text-fg hover:bg-bg/90 absolute top-1/2 right-2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full opacity-90 transition-colors"
      aria-label={m.common_image_next()}
      onclick={() => step(1)}>
      <Icon name="chevron-right" class="h-5 w-5" />
    </button>
    <span
      class="timecode bg-bg/70 pointer-events-none absolute bottom-2 left-2 rounded px-1.5 py-0.5 text-[0.65rem] text-white"
      aria-live="polite">
      {m.media_episode_slide({ index: index + 1, count: slides.length })}
    </span>
  {/if}

  {#if caption && current?.kind !== "video"}
    <span
      class="timecode bg-bg/60 pointer-events-none absolute right-2 bottom-2 rounded px-1.5 py-0.5 text-[0.65rem] text-white/80">
      {caption}
    </span>
  {/if}
</div>

{#if lightbox}
  <Lightbox
    images={images.map((src) => ({ src, alt }))}
    video={lightbox.video
      ? { videoId: lightbox.video, alt: m.media_trailer() }
      : null}
    index={lightbox.index}
    onClose={() => (lightbox = null)} />
{/if}
