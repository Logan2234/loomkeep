<script lang="ts">
  // Global toast stack; mounted once in the root layout. Reads from the
  // `toast` store (src/lib/toast.svelte.ts) so any component can call
  // `toast.success(...)` / `toast.error(...)` without prop-drilling.
  import { prefersReducedMotion } from "$lib/motion";
  import { flip } from "svelte/animate";
  import { fade, fly } from "svelte/transition";
  import Icon from "./Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { toast, type ToastVariant } from "$lib/toast.svelte";

  const reduced = prefersReducedMotion();

  const VARIANT_CLASSES: Record<ToastVariant, string> = {
    success: "border-success/40 bg-success/10 text-success",
    error: "border-danger/40 bg-danger/10 text-danger",
    info: "border-border bg-surface-2 text-fg",
  };
</script>

<div
  class="pointer-events-none fixed inset-x-4 bottom-20 z-[60] flex flex-col items-center gap-2 md:inset-x-auto md:right-4 md:bottom-4 md:items-end">
  {#each toast.items as t (t.id)}
    <div
      role="status"
      in:fly={{ y: 12, duration: reduced ? 0 : 150 }}
      out:fade={{ duration: reduced ? 0 : 120 }}
      animate:flip={{ duration: reduced ? 0 : 200 }}
      class="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur {VARIANT_CLASSES[
        t.variant
      ]}">
      <span class="flex-1">{t.message}</span>
      <button
        type="button"
        aria-label={m.common_close()}
        class="shrink-0 opacity-70 hover:opacity-100"
        onclick={() => toast.dismiss(t.id)}>
        <Icon name="x" class="h-3.5 w-3.5" />
      </button>
    </div>
  {/each}
</div>
