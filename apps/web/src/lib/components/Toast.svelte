<script lang="ts">
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { toast, type ToastVariant } from "$lib/toast.svelte";
  import { flip } from "svelte/animate";
  import { fade, fly } from "svelte/transition";
  import Icon from "./Icon.svelte";

  const reduced = prefersReducedMotion();

  const VARIANT_STYLES: Record<
    ToastVariant,
    { rail: string; icon: "check" | "warning" | "bell"; iconClass: string }
  > = {
    success: {
      rail: "bg-success",
      icon: "check",
      iconClass: "text-success border-success/30 bg-success/10",
    },
    error: {
      rail: "bg-danger",
      icon: "warning",
      iconClass: "text-danger border-danger/30 bg-danger/10",
    },
    info: {
      rail: "bg-accent",
      icon: "bell",
      iconClass: "text-accent border-accent/30 bg-accent/10",
    },
  };
</script>

<div
  class="pointer-events-none fixed inset-x-4 bottom-20 z-60 flex flex-col items-center gap-2 md:inset-x-auto md:right-4 md:bottom-4 md:items-end">
  {#each toast.items as t (t.id)}
    {@const style = VARIANT_STYLES[t.variant]}
    <div
      role="status"
      in:fly={{ y: 12, duration: reduced ? 0 : 150 }}
      out:fade={{ duration: reduced ? 0 : 120 }}
      animate:flip={{ duration: reduced ? 0 : 200 }}
      class="border-border bg-surface pointer-events-auto relative flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-xl border py-3.5 pr-3 pl-4 text-sm shadow-xl">
      <span class="absolute inset-y-0 left-0 w-1 {style.rail}"></span>
      <span
        class="grid h-7 w-7 shrink-0 place-items-center rounded-lg border {style.iconClass}"
        aria-hidden="true">
        <Icon name={style.icon} class="h-3.5 w-3.5" />
      </span>
      <span class="flex-1 leading-snug">{t.message}</span>
      <button
        type="button"
        aria-label={m.common_close()}
        class="text-dim hover:bg-surface-2 hover:text-fg shrink-0 rounded-md p-1 transition-colors"
        onclick={() => toast.dismiss(t.id)}>
        <Icon name="x" class="h-3.5 w-3.5" />
      </button>
    </div>
  {/each}
</div>
