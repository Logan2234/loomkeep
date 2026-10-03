<script lang="ts">
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { toast, type ToastVariant } from "$lib/toast.svelte";
  import { flip } from "svelte/animate";
  import { fade, fly } from "svelte/transition";
  import Icon from "./Icon.svelte";

  const reduced = prefersReducedMotion();

  // Hovered or holding focus, a toast stays put: its countdown resumes only
  // once neither the pointer nor the keyboard is on it any more.
  function release(el: HTMLElement, id: number, leaving: EventTarget | null) {
    const focused =
      leaving === null
        ? el.contains(document.activeElement)
        : el.contains(leaving as Node);
    if (!focused && !el.matches(":hover")) toast.resume(id);
  }

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

{#snippet actionButton(id: number, label: string, index: number)}
  <button
    type="button"
    class="text-accent hover:bg-accent/10 shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition-colors"
    onclick={() => toast.selectAction(id, index)}>
    {label}
  </button>
{/snippet}

<div
  class="pointer-events-none fixed inset-x-4 bottom-20 z-60 flex flex-col items-center gap-2 md:inset-x-auto md:right-4 md:bottom-4 md:items-end">
  {#each toast.items as t (t.id)}
    {@const style = VARIANT_STYLES[t.variant]}
    <div
      role="status"
      onmouseenter={() => toast.pause(t.id)}
      onmouseleave={(e) => release(e.currentTarget, t.id, null)}
      onfocusin={() => toast.pause(t.id)}
      onfocusout={(e) => release(e.currentTarget, t.id, e.relatedTarget)}
      in:fly={{ y: 12, duration: reduced ? 0 : 150 }}
      out:fade={{ duration: reduced ? 0 : 120 }}
      animate:flip={{ duration: reduced ? 0 : 200 }}
      class="toast border-border bg-surface pointer-events-auto relative flex w-full max-w-md items-center gap-3 overflow-hidden rounded-xl border py-3.5 pr-3 pl-4 text-sm shadow-xl">
      <span class="absolute inset-y-0 left-0 w-1 {style.rail}"></span>
      <span
        class="grid h-7 w-7 shrink-0 place-items-center rounded-lg border {style.iconClass}"
        aria-hidden="true">
        <Icon name={style.icon} class="h-3.5 w-3.5" />
      </span>
      <!-- One action sits beside the message; several go under it, so the
           message keeps its width. -->
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="leading-snug">{t.message}</span>
        {#if t.actions.length > 1}
          <div class="-ml-2.5 flex flex-wrap gap-x-1">
            {#each t.actions as action, index (action.label)}
              {@render actionButton(t.id, action.label, index)}
            {/each}
          </div>
        {/if}
      </div>
      {#if t.actions.length === 1}
        {@render actionButton(t.id, t.actions[0].label, 0)}
      {/if}
      <button
        type="button"
        aria-label={m.common_close()}
        class="text-dim hover:bg-surface-2 hover:text-fg shrink-0 rounded-md p-1 transition-colors"
        onclick={() => toast.dismiss(t.id)}>
        <Icon name="x" class="h-3.5 w-3.5" />
      </button>
      {#if t.actions.length > 0 && t.duration > 0}
        <span
          class="toast-countdown bg-accent absolute right-0 bottom-0 h-0.5"
          style={`animation-duration: ${t.duration}ms`}
          aria-hidden="true"></span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toast-countdown {
    width: calc(100% - 0.25rem);
    transform-origin: left;
    animation-name: toast-countdown;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }

  .toast:hover .toast-countdown,
  .toast:focus-within .toast-countdown {
    animation-play-state: paused;
  }

  @keyframes toast-countdown {
    to {
      transform: scaleX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast-countdown {
      animation-name: none;
    }
  }
</style>
