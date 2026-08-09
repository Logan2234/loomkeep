<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import Avatar from "./Avatar.svelte";
  import Icon from "./Icon.svelte";

  // Fullscreen zoom for a profile avatar — same chrome as Lightbox, but
  // wrapping Avatar itself (identicon fallback or uploaded picture) instead
  // of a plain <img>.
  let {
    seed,
    url = null,
    onClose,
  }: { seed: string; url?: string | null; onClose: () => void } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onClose()} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
  role="dialog"
  aria-modal="true"
  aria-label="Avatar en grand">
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

  <button
    type="button"
    class="relative cursor-zoom-out"
    aria-label="Réduire l'avatar"
    onclick={onClose}>
    <div class="pointer-events-none">
      <Avatar {seed} {url} size={280} />
    </div>
  </button>
</div>
