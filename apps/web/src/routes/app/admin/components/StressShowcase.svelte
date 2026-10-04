<script lang="ts">
  import Banner from "$lib/components/Banner.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import { m } from "$lib/paraglide/messages";
  let values = $state<string[]>([]);
  type Mode = "long" | "empty" | "loading" | "error";
  let mode = $state<Mode>("long");
  const modes: { value: Mode; label: () => string }[] = [
    { value: "long", label: m.common_details },
    { value: "empty", label: m.admin_no_matches },
    { value: "loading", label: m.common_loading },
    { value: "error", label: m.common_error },
  ];
  const options = Array.from({ length: 60 }, (_, index) => ({
    value: String(index),
    label: `${index + 1} · ${m.admin_components_sample_title_one().repeat(4)}`,
  }));
</script>

<div class="space-y-4">
  <Combobox
    label={m.admin_components_stress()}
    searchable
    multiselect
    {options}
    {values}
    onChange={(next) => (values = next)} />
  <div class="max-w-full overflow-x-auto">
    <SegmentedControl
      label={m.admin_components_stress()}
      options={modes.map((option) => ({
        value: option.value,
        label: option.label(),
      }))}
      value={mode}
      onChange={(value) => (mode = value)} />
  </div>
  {#if mode === "long"}<Banner variant="info"
      >{m.admin_components_banner_info().repeat(8)}</Banner>
  {:else if mode === "empty"}<EmptyState>{m.admin_no_matches()}</EmptyState>
  {:else if mode === "loading"}<div aria-label={m.common_loading()}>
      {#each { length: 3 } as _, index (index)}<CardRowSkeleton />{/each}
    </div>
  {:else}<Banner variant="error"
      ><div class="flex flex-wrap items-center justify-between gap-3">
        <span>{m.admin_components_banner_error().repeat(4)}</span><button
          class="btn btn-ghost btn-sm"
          onclick={() => (mode = "loading")}>{m.common_retry()}</button>
      </div></Banner
    >{/if}
</div>
