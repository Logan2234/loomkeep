<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import { prefersReducedMotion } from "$lib/motion";
  import { fade, scale } from "svelte/transition";
  import Icon from "./Icon.svelte";

  // Fullscreen zoom over one or more images, with a carousel when there's
  // more than one (arrow keys / buttons / swipe). A single image just zooms,
  // no navigation chrome. An optional trailer slots in as slide 0 ahead of
  // the images, when the caller has one (e.g. a game's trailer alongside its
  // screenshots).
  let {
    images,
    video = null,
    index = $bindable(0),
    onClose,
  }: {
    images: { src: string; alt: string }[];
    video?: { videoId: string; alt: string } | null;
    index?: number;
    onClose: () => void;
  } = $props();

  const totalCount = $derived(images.length + (video ? 1 : 0));
  const hasMultiple = $derived(totalCount > 1);
  const isVideoSlide = $derived(video !== null && index === 0);
  const currentImage = $derived(images[video ? index - 1 : index]);
  let touchStartX = $state<number | null>(null);
  const reduced = prefersReducedMotion();

  function next() {
    index = (index + 1) % totalCount;
  }

  function prev() {
    index = (index - 1 + totalCount) % totalCount;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
    else if (hasMultiple && e.key === "ArrowRight") next();
    else if (hasMultiple && e.key === "ArrowLeft") prev();
  }

  function onTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
  }

  function onTouchEnd(e: TouchEvent) {
    if (touchStartX === null || !hasMultiple) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    // A short tap shouldn't trigger a swipe.
    if (Math.abs(delta) > 40) {
      if (delta < 0) next();
      else prev();
    }
    touchStartX = null;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
  in:fade={{ duration: reduced ? 0 : 140 }}
  out:fade={{ duration: reduced ? 0 : 120 }}
  role="dialog"
  aria-modal="true"
  aria-label={isVideoSlide ? m.media_trailer() : m.common_image_large()}
  tabindex="-1"
  ontouchstart={onTouchStart}
  ontouchend={onTouchEnd}>
  <!-- Full-bleed backdrop button, behind the actual content below (later
       siblings paint on top), so clicking anywhere outside the content closes
       the lightbox without needing stopPropagation everywhere else. -->
  <button
    type="button"
    class="absolute inset-0"
    aria-label={m.common_close()}
    onclick={onClose}>
  </button>

  <button
    type="button"
    class="absolute top-4 right-4 z-20 rounded-full bg-black/40 p-2 text-white transition-colors hover:bg-black/60"
    aria-label={m.common_close()}
    onclick={onClose}>
    <Icon name="x" class="h-5 w-5" />
  </button>

  {#if hasMultiple}
    <button
      type="button"
      class="absolute left-2 z-20 rounded-full bg-black/40 p-2 text-white transition-colors hover:bg-black/60 sm:left-4"
      aria-label={m.common_image_previous()}
      onclick={prev}>
      <Icon name="chevron-left" class="h-6 w-6" />
    </button>
    <button
      type="button"
      class="absolute right-2 z-20 rounded-full bg-black/40 p-2 text-white transition-colors hover:bg-black/60 sm:right-4"
      aria-label={m.common_image_next()}
      onclick={next}>
      <Icon name="chevron-right" class="h-6 w-6" />
    </button>
  {/if}

  <div
    class="relative z-10"
    in:scale={{ start: 0.96, duration: reduced ? 0 : 180 }}
    out:scale={{ start: 0.96, duration: reduced ? 0 : 140 }}>
    {#if isVideoSlide && video}
      <!-- `relative`: an absolutely positioned element (like the backdrop
         close-button below) always paints above a static one regardless of
         DOM order, so without this the invisible backdrop button would sit
         on top of the video and swallow every click meant for the player. -->
      <div class="relative aspect-video w-[92vw] max-w-3xl">
        <iframe
          class="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1`}
          title={video.alt}
          referrerpolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen>
        </iframe>
      </div>
    {:else}
      <button
        type="button"
        class="relative cursor-zoom-out"
        aria-label={m.common_image_reduce()}
        onclick={onClose}>
        <img
          src={currentImage.src}
          alt={currentImage.alt}
          class="pointer-events-none max-h-[88vh] max-w-[92vw] object-contain" />
      </button>
    {/if}
  </div>

  {#if hasMultiple}
    <div class="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
      {#each Array(totalCount) as _, i (i)}
        <button
          type="button"
          aria-label={video && i === 0
            ? m.media_trailer()
            : m.common_image_number({ index: i + 1 - (video ? 1 : 0) })}
          aria-current={i === index}
          onclick={() => (index = i)}
          class="h-1.5 w-1.5 rounded-full transition-colors {i === index
            ? 'bg-white'
            : 'bg-white/40 hover:bg-white/70'}">
        </button>
      {/each}
    </div>
  {/if}
</div>
