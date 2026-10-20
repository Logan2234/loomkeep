<script lang="ts">
  import Dropdown from "#lib/components/Dropdown.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { m } from "#lib/paraglide/messages.js";

  // Where the game is played: one of the platforms IGDB lists it on, or
  // none said. Same menu as the ownership one beside it.
  let {
    platform,
    platforms,
    onChange,
  }: {
    platform: string | null;
    platforms: string[];
    onChange: (platform: string | null) => void;
  } = $props();

  const current = $derived(platform ?? m.game_platform_unset());
</script>

{#snippet check(on: boolean)}
  <span class="text-accent grid h-4 w-4 place-items-center">
    {#if on}<Icon name="check" class="h-3.5 w-3.5" />{/if}
  </span>
{/snippet}

<div class="flex flex-col gap-2">
  <span
    class="timecode flex items-center gap-2 text-[0.62rem] tracking-[0.18em] uppercase">
    {m.game_platform_title()}
    {#if isFeatureNew("game-platform")}<NewBadge />{/if}
  </span>
  <Dropdown placement="bottom-start" role="menu" class="min-w-52">
    {#snippet trigger({ open, toggle, onkeydown })}
      <button
        type="button"
        class="border-border text-fg hover:border-accent inline-flex max-w-full items-center gap-1.5 self-start rounded-lg border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors"
        aria-label={`${m.game_platform_title()} : ${current}`}
        aria-haspopup="menu"
        aria-expanded={open}
        {onkeydown}
        onclick={toggle}>
        <span class="truncate">{current}</span>
        <Icon
          name="chevron-right"
          class="h-3.5 w-3.5 transition-transform {open
            ? 'rotate-270'
            : 'rotate-90'}" />
      </button>
    {/snippet}
    {#snippet children({ close })}
      <button
        role="menuitemradio"
        aria-checked={platform === null}
        class="menu-item"
        onclick={() => {
          close();
          if (platform !== null) onChange(null);
        }}>
        {@render check(platform === null)}
        {m.game_platform_unset()}
      </button>
      <div class="border-border my-1 border-t"></div>
      {#each platforms as option (option)}
        <button
          role="menuitemradio"
          aria-checked={platform === option}
          class="menu-item"
          onclick={() => {
            close();
            if (platform !== option) onChange(option);
          }}>
          {@render check(platform === option)}
          {option}
        </button>
      {/each}
    {/snippet}
  </Dropdown>
</div>
