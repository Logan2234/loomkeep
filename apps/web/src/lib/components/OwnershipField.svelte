<script lang="ts">
  import { joinMeta } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import Dropdown from "./Dropdown.svelte";
  import Icon from "./Icon.svelte";
  import OwnershipMenuItems from "./OwnershipMenuItems.svelte";

  // Possession status (physique/numérique/abonnement…/emprunté) plus an
  // optional free-form detail (e.g. "Steam", "Netflix") for whichever statuses
  // the caller maps a preset list to — picked from one menu, the presets in a
  // submenu of their status.
  let {
    status,
    source,
    statusOptions,
    sourceOptionsByStatus,
    onChange,
  }: {
    status: string;
    source: string | null;
    statusOptions: { value: string; label: string }[];
    sourceOptionsByStatus: Record<string, string[]>;
    onChange: (status: string, source: string | null) => void;
  } = $props();

  const current = $derived(
    joinMeta(
      statusOptions.find((option) => option.value === status)?.label ?? status,
      source,
    ),
  );
</script>

<div class="flex flex-col gap-2">
  <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
    {m.ownership_title()}
  </span>
  <Dropdown placement="bottom-start" role="menu" class="min-w-52">
    {#snippet trigger({ open, toggle, onkeydown })}
      <button
        type="button"
        class="border-border text-fg hover:border-accent inline-flex max-w-full items-center gap-1.5 self-start rounded-lg border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors"
        aria-label={`${m.ownership_title()} : ${current}`}
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
      <OwnershipMenuItems
        options={statusOptions}
        sourcesByStatus={sourceOptionsByStatus}
        {status}
        {source}
        onPick={(nextStatus, nextSource) => {
          close();
          onChange(nextStatus, nextSource);
        }} />
    {/snippet}
  </Dropdown>
</div>
