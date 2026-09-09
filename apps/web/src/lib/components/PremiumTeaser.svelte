<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  let {
    locked,
    class: className = "",
    children,
  }: { locked: boolean; class?: string; children: Snippet } = $props();
</script>

<div class="relative {className}">
  <!-- Capped on a phone: a locked section still rendered its full height of
       blurred content, so /app/stats made you scroll through hundreds of
       pixels you can't read. The cap keeps enough to show what's behind the
       lock without the scroll. -->
  <div
    class={locked
      ? "pointer-events-none max-h-56 overflow-hidden p-2 blur-sm select-none md:max-h-none"
      : ""}
    aria-hidden={locked}>
    {@render children()}
  </div>
  {#if locked}
    <div
      class="bg-surface/80 absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-xl">
      <span
        class="bg-accent text-accent-fg grid h-8 w-8 place-items-center rounded-full">
        <Icon name="lock" class="h-4 w-4" />
      </span>
      <p class="text-fg text-xs font-semibold">
        {m.premium_locked()}
      </p>
    </div>
  {/if}
</div>
