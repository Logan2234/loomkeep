<script lang="ts">
  import { dialogFocus } from "#lib/actions/dialogFocus.js";
  import { portal } from "#lib/actions/portal.js";
  import { scrollLock } from "#lib/actions/scrollLock.js";
  import { m } from "#lib/paraglide/messages.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { fade } from "svelte/transition";
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  let {
    label,
    children,
    onClose,
    onkeydown,
    ontouchstart,
    ontouchend,
  }: {
    label: string;
    children: Snippet;
    onClose: () => void;
    onkeydown?: (e: KeyboardEvent) => void;
    ontouchstart?: (e: TouchEvent) => void;
    ontouchend?: (e: TouchEvent) => void;
  } = $props();
  let closeButton = $state<HTMLButtonElement | null>(null);
  const reduced = prefersReducedMotion();
</script>

<div
  use:portal
  use:scrollLock
  use:dialogFocus={{ initialFocus: closeButton, onEscape: onClose }}
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
  in:fade={{ duration: reduced ? 0 : 140 }}
  out:fade={{ duration: reduced ? 0 : 120 }}
  role="dialog"
  aria-modal="true"
  aria-label={label}
  tabindex="-1"
  {onkeydown}
  {ontouchstart}
  {ontouchend}>
  <!-- Full-bleed backdrop button, behind the actual content below (later
       siblings paint on top), so clicking anywhere outside the content closes
       the lightbox without needing stopPropagation everywhere else. -->
  <button
    type="button"
    data-dialog-backdrop
    tabindex="-1"
    class="absolute inset-0"
    aria-label={m.common_close()}
    onclick={onClose}>
  </button>

  <button
    bind:this={closeButton}
    type="button"
    class="absolute top-4 right-4 z-20 rounded-full bg-black/40 p-2 text-white transition-colors hover:bg-black/60"
    aria-label={m.common_close()}
    onclick={onClose}>
    <Icon name="x" class="h-5 w-5" />
  </button>

  {@render children()}
</div>
