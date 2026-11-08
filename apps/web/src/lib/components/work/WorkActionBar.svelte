<script lang="ts">
  import AddToListButton from "#lib/components/AddToListButton.svelte";
  import Dropdown from "#lib/components/Dropdown.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import ShareWorkMenuItem from "#lib/components/ShareWorkMenuItem.svelte";
  import WorkMoreMenu from "#lib/components/WorkMoreMenu.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { IconName } from "#lib/types/icon-name.js";
  import type { ListItemTargetType } from "@loomkeep/shared";
  import type { Snippet } from "svelte";
  import { scale } from "svelte/transition";

  // The sticky action bar of a game, book or album page (FIC-06), the same
  // shape as the video one: status (the title once stuck), discussion,
  // list, favorite and a "…" for the rarer actions.
  let {
    tracked,
    status,
    statusTone = "accent",
    statusDetail,
    compact,
    title,
    saving,
    favorite = false,
    listTarget,
    actions = [],
    onAdd,
    onToggleFavorite,
    onShare,
    onRemove,
    leading,
    socialActions,
  }: {
    tracked: boolean;
    status?: string;
    statusTone?: "accent" | "success" | "danger";
    /** After the status, e.g. "page 212 / 662". */
    statusDetail?: string;
    compact: boolean;
    title: string;
    saving: boolean;
    favorite?: boolean;
    listTarget?: { type: ListItemTargetType; id: string };
    actions?: {
      label: string;
      icon: IconName;
      onSelect: () => void;
      separator?: boolean;
    }[];
    onAdd: () => void;
    onToggleFavorite: () => void;
    onShare: () => void;
    onRemove: () => void;
    /** Before the status, e.g. the release reminder of an upcoming title. */
    leading?: Snippet;
    socialActions?: Snippet;
  } = $props();

  const reduced = prefersReducedMotion();
</script>

{#snippet statusLine(inline: boolean)}
  {#if status}
    {#if !inline}
      <span
        class="h-2 w-2 shrink-0 rounded-full {statusTone === 'danger'
          ? 'bg-danger'
          : statusTone === 'success'
            ? 'bg-success'
            : 'bg-accent'}"></span>
    {/if}
    <span class="truncate">
      <span class={inline ? "" : "font-semibold"}>{status}</span>
      {#if statusDetail}
        · <span class="timecode text-dim">{statusDetail}</span>
      {/if}
    </span>
  {/if}
{/snippet}

<div
  data-action-bar
  class="bg-bg border-border sticky top-[env(safe-area-inset-top)] z-20 border-b">
  <div
    class="mx-auto flex min-h-14 max-w-5xl items-center gap-2.5 py-2 pr-4 pl-5 md:px-8">
    {#if !tracked}
      <button
        class="btn btn-primary shrink-0"
        disabled={saving}
        onclick={onAdd}>
        <Icon name="plus" class="h-4 w-4" />
        {m.library_add()}
      </button>
    {:else}
      {@render leading?.()}
    {/if}

    <!-- Once stuck, the title takes the status's place, the status under it. -->
    <div class="relative h-10 min-w-0 flex-1">
      <p
        class="absolute inset-0 flex items-center gap-2 text-sm transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none {compact
          ? 'pointer-events-none translate-y-1.5 opacity-0'
          : ''}"
        aria-hidden={compact}>
        {@render statusLine(false)}
      </p>
      <div
        class="absolute inset-0 flex min-w-0 flex-col justify-center transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none {compact
          ? ''
          : 'pointer-events-none translate-y-1.5 opacity-0'}"
        aria-hidden={!compact}>
        <h2 class="font-display truncate text-sm font-bold">{title}</h2>
        {#if status}
          <p class="text-dim flex min-w-0 text-[0.7rem]">
            {@render statusLine(true)}
          </p>
        {/if}
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      {#if socialActions}
        <div class="mr-1 flex">{@render socialActions()}</div>
      {/if}
      {#if !tracked}
        <WorkMoreMenu onshare={onShare} />
      {:else}
        {#if listTarget}
          <AddToListButton
            targetType={listTarget.type}
            targetId={listTarget.id} />
        {/if}
        <button
          type="button"
          aria-pressed={favorite}
          disabled={saving}
          title={favorite
            ? m.common_favorite_remove()
            : m.common_favorite_add()}
          aria-label={favorite
            ? m.common_favorite_remove()
            : m.common_favorite_add()}
          onclick={onToggleFavorite}
          class="btn-icon h-9 w-9 border {favorite
            ? 'border-accent text-accent'
            : 'border-border text-dim hover:bg-surface-2 hover:text-fg'}">
          {#key favorite}
            <span in:scale|global={{ duration: reduced ? 0 : 200, start: 0.5 }}>
              <Icon
                name="star"
                class="h-4 w-4 {favorite ? 'fill-accent' : ''}" />
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
              <Icon name="dots-horizontal" class="h-4 w-4" />
            </button>
          {/snippet}
          {#snippet children({ close })}
            {#each actions as action (action.label)}
              <button
                role="menuitem"
                type="button"
                class="menu-item {action.separator
                  ? 'border-border border-t'
                  : ''}"
                onclick={() => {
                  close();
                  action.onSelect();
                }}>
                <Icon name={action.icon} class="h-4 w-4" />
                {action.label}
              </button>
            {/each}
            <ShareWorkMenuItem
              separated={actions.length > 0}
              onclick={() => {
                close();
                onShare();
              }} />
            <button
              role="menuitem"
              type="button"
              class="menu-item menu-item-danger border-border border-t"
              onclick={() => {
                close();
                onRemove();
              }}>
              <Icon name="trash" class="h-4 w-4" />
              {m.tracking_remove()}
            </button>
          {/snippet}
        </Dropdown>
      {/if}
    </div>
  </div>
</div>
