<script lang="ts">
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { IconName } from "#lib/types/icon-name.js";
  import type { ListItemTargetType } from "@loomkeep/shared";
  import type { Snippet } from "svelte";
  import { scale } from "svelte/transition";
  import AddToListButton from "./AddToListButton.svelte";
  import Dropdown from "./Dropdown.svelte";
  import Icon from "./Icon.svelte";

  const reduced = prefersReducedMotion();

  let {
    favorite,
    saving,
    targetType,
    targetId,
    onToggleFavorite,
    onRemove,
    actions = [],
    extra,
    children,
  }: {
    favorite: boolean;
    saving: boolean;
    targetType: ListItemTargetType;
    targetId: string;
    onToggleFavorite: () => void;
    onRemove: () => void;
    actions?: {
      label: string;
      icon: IconName;
      onSelect: () => void;
      separator?: boolean;
    }[];
    /** Another action, first in the row. */
    extra?: Snippet;
    children: Snippet;
  } = $props();
</script>

<div
  class="tracking-panel border-border bg-surface mt-6 flex flex-col gap-4 rounded-xl border p-4 {reduced
    ? ''
    : 'tracking-panel-enter'}">
  <div class="flex items-center justify-between gap-2">
    <span class="text-sm font-semibold">{m.tracking_title()}</span>

    <div class="flex shrink-0 items-center gap-2.5">
      {@render extra?.()}
      <AddToListButton {targetType} {targetId} />

      <button
        type="button"
        aria-pressed={favorite}
        disabled={saving}
        title={favorite ? m.common_favorite_remove() : m.common_favorite_add()}
        aria-label={favorite
          ? m.common_favorite_remove()
          : m.common_favorite_add()}
        onclick={onToggleFavorite}
        class="btn-icon h-9 w-9 border {favorite
          ? 'border-accent text-accent'
          : 'border-border text-dim hover:bg-surface-2 hover:text-fg'}">
        {#key favorite}
          <span in:scale|global={{ duration: reduced ? 0 : 200, start: 0.5 }}>
            <Icon name="star" class="h-4 w-4 {favorite ? 'fill-accent' : ''}" />
          </span>
        {/key}
      </button>

      <Dropdown placement="bottom-end" class="min-w-64">
        {#snippet trigger({ open, toggle, onkeydown })}
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            {onkeydown}
            aria-label={m.common_more_actions()}
            title={m.common_more_actions()}
            onclick={toggle}
            class="btn-icon border-border h-9 w-9 border transition-colors">
            <Icon name="dots-vertical" class="h-4 w-4" />
          </button>
        {/snippet}
        {#snippet children({ close })}
          {#each actions as action (action.label)}
            <button
              role="menuitem"
              type="button"
              class="menu-item"
              class:border-t={action.separator}
              class:border-border={action.separator}
              disabled={saving}
              onclick={() => {
                close();
                action.onSelect();
              }}>
              <Icon name={action.icon} class="h-4 w-4" />
              {action.label}
            </button>
          {/each}
          <button
            role="menuitem"
            type="button"
            class="menu-item menu-item-danger border-border border-t"
            disabled={saving}
            onclick={() => {
              close();
              onRemove();
            }}>
            <Icon name="trash" class="h-4 w-4" />
            {m.tracking_remove()}
          </button>
        {/snippet}
      </Dropdown>
    </div>
  </div>

  {@render children()}
</div>

<style>
  .tracking-panel-enter {
    animation: tracking-panel-enter 320ms cubic-bezier(0.2, 1.4, 0.4, 1);
  }

  @keyframes tracking-panel-enter {
    from {
      transform: scale(0.94);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
