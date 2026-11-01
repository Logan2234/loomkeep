<script lang="ts">
  import {
    DARK_THEME,
    LIGHT_THEME,
    type ThemeDefinition,
  } from "#lib/constants/theme-definitions.js";
  import { theme } from "#lib/theme.svelte.js";

  const { theme: t }: { theme: ThemeDefinition } = $props();

  const active = $derived(theme.choice === t.mode);
</script>

{#snippet screen(colors: ThemeDefinition, cls = "")}
  <div class={cls} style="background:{colors.bg}">
    <div
      class="flex h-3 items-center gap-1 px-1.5"
      style="background:{colors.surface}">
      <span class="h-1 w-1 rounded-full" style="background:{colors.accent}"
      ></span>
      <span class="h-0.5 w-3 rounded-full" style="background:{colors.line}"
      ></span>
    </div>
    <div class="flex flex-col gap-1 p-1.5">
      <span
        class="h-0.5 rounded-full"
        style="width:55%;background:{colors.line}"></span>
      <span
        class="h-0.5 rounded-full"
        style="width:35%;background:{colors.accent}"></span>
    </div>
  </div>
{/snippet}

<button
  type="button"
  class="w-28 min-w-0 rounded-lg border p-2 text-center transition-colors {active
    ? 'border-accent'
    : 'border-border'}"
  aria-pressed={active}
  onclick={() => theme.set(t.mode)}>
  <div class="relative mb-2 overflow-hidden rounded">
    {#if t.mode === "system"}
      {@render screen(DARK_THEME)}
      {@render screen(
        LIGHT_THEME,
        "absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]",
      )}
      <svg
        class="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true">
        <line
          x1="100"
          y1="0"
          x2="0"
          y2="100"
          stroke="#f5b841"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke" />
      </svg>
    {:else}
      {@render screen(t)}
    {/if}
  </div>
  <span class="text-xs font-semibold {active ? 'text-accent' : 'text-dim'}">
    {t.label}
  </span>
</button>
