<script lang="ts">
  import { untrack } from "svelte";
  import { m } from "$lib/paraglide/messages.js";
  import Combobox from "./Combobox.svelte";

  // Possession status (physique/numérique/abonnement…/emprunté) plus an
  // optional free-form detail (e.g. "Steam", "Netflix") for whichever statuses
  // the caller maps a preset list to. Picking "Autre…" in the detail dropdown
  // reveals a text input for a value outside the presets.
  const CUSTOM = "__custom__";

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

  const presets = $derived(sourceOptionsByStatus[status] ?? null);

  let showCustomInput = $state(false);
  let customText = $state("");

  // Recomputed only when `status` changes (not on every `source` update), so
  // picking "Autre…" isn't immediately overridden by the round-tripped null.
  $effect(() => {
    const s = status;
    const presetsForStatus = sourceOptionsByStatus[s] ?? null;
    const src = untrack(() => source);
    const isCustom =
      !!presetsForStatus && src !== null && !presetsForStatus.includes(src);
    showCustomInput = isCustom;
    customText = isCustom ? (src ?? "") : "";
  });

  function pickStatus(values: string[]) {
    onChange(values[0], null);
  }

  function pickSource(values: string[]) {
    const next = values[0];
    if (next === CUSTOM) {
      showCustomInput = true;
      customText = "";
    } else {
      showCustomInput = false;
      onChange(status, next);
    }
  }

  function commitCustom(e: Event & { currentTarget: HTMLInputElement }) {
    const trimmed = e.currentTarget.value.trim();
    customText = trimmed;
    onChange(status, trimmed === "" ? null : trimmed);
  }
</script>

<div class="flex flex-col gap-2">
  <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
    {m.ownership_title()}
  </span>
  <div class="flex flex-wrap items-center gap-2">
    <Combobox
      label={m.common_status()}
      options={statusOptions}
      values={[status]}
      onChange={pickStatus} />
    {#if presets}
      <Combobox
        label={m.ownership_detail_label()}
        options={[
          ...presets.map((p) => ({ label: p, value: p })),
          { label: m.ownership_other(), value: CUSTOM },
        ]}
        values={[showCustomInput ? CUSTOM : (source ?? "")]}
        onChange={pickSource} />
    {/if}
  </div>
  {#if presets && showCustomInput}
    <input
      type="text"
      class="input"
      placeholder={m.ownership_source_placeholder()}
      value={customText}
      onchange={commitCustom} />
  {/if}
</div>
