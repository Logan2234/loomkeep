<script lang="ts">
  import { formatNumber } from "$lib/format";
  // One dense figure + caption, the unit every admin card counts in (/admin/stats
  // sections, and the summary headers of the operational pages). Smaller and
  // quieter than KpiStrip's tiles: those head the page, these sit inside a card.
  let {
    value,
    label,
    alert = false,
  }: {
    value: string | number;
    label: string;
    /** Turns the figure red — used for a moderation queue that isn't empty. */
    alert?: boolean;
  } = $props();
</script>

<div class="flex flex-col gap-0.5">
  <span
    class="font-display text-xl font-extrabold tabular-nums"
    class:text-danger={alert}>
    {typeof value === "number" ? formatNumber(value) : value}
  </span>
  <span class="text-dim text-[11.5px]">{label}</span>
</div>
