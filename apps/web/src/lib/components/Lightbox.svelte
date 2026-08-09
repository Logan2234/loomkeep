<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import Icon from "./Icon.svelte";

  // Fullscreen zoom over one or more images, with a carousel when there's
  // more than one (arrow keys / buttons / swipe). A single image just zooms,
  // no navigation chrome.
  let {
    images,
    index = $bindable(0),
    onClose,
  }: {
    images: { src: string; alt: string }[];
    index?: number;
    onClose: () => void;
  } = $props();

  const hasMultiple = $derived(images.length > 1);
  let touchStartX = $state<number | null>(null);

  function next() {
    index = (index + 1) % images.length;
  }

  function prev() {
    index = (index - 1 + images.length) % images.length;
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
  role="dialog"
  aria-modal="true"
  aria-label="Image en grand"
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
    class="absolute top-4 right-4 rounded-full bg-black/40 p-2 text-white transition-colors hover:bg-black/60"
    aria-label={m.common_close()}
    onclick={onClose}>
    <Icon name="x" class="h-5 w-5" />
  </button>

  {#if hasMultiple}
    <button
      type="button"
      class="absolute left-2 rounded-full bg-black/40 p-2 text-white transition-colors hover:bg-black/60 sm:left-4"
      aria-label="Image précédente"
      onclick={prev}>
      <Icon name="chevron-left" class="h-6 w-6" />
    </button>
    <button
      type="button"
      class="absolute right-2 rounded-full bg-black/40 p-2 text-white transition-colors hover:bg-black/60 sm:right-4"
      aria-label="Image suivante"
      onclick={next}>
      <Icon name="chevron-right" class="h-6 w-6" />
    </button>
  {/if}

  <button
    type="button"
    class="relative cursor-zoom-out"
    aria-label="Réduire l'image"
    onclick={onClose}>
    <img
      src={images[index].src}
      alt={images[index].alt}
      class="pointer-events-none max-h-[88vh] max-w-[92vw] object-contain" />
  </button>

  {#if hasMultiple}
    <div class="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1.5">
      {#each images as _, i (i)}
        <button
          type="button"
          aria-label={`Image ${i + 1}`}
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
