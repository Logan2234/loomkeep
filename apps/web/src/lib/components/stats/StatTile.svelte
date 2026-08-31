<script lang="ts">
  import { formatNumber } from "$lib/format";
  // The headline figure of /stats: one big number, its caps label and an
  // optional secondary line. Every domain section opens on a row of four.
  let {
    value,
    unit,
    label,
    hint,
  }: {
    value: string | number;
    /** Small suffix glued to the number ("h", "min", "/10"). */
    unit?: string;
    label: string;
    /** Secondary line under the label — omitted when there's nothing to say. */
    hint?: string;
  } = $props();
</script>

<div class="card p-4">
  <p class="font-display text-3xl font-extrabold tabular-nums">
    {typeof value === "number" ? formatNumber(value) : value}{#if unit}<span
        class="text-dim text-lg">{unit}</span
      >{/if}
  </p>
  <p class="text-dim mt-1 text-xs tracking-wide uppercase">{label}</p>
  {#if hint}
    <p class="text-dim text-xs">{hint}</p>
  {/if}
</div>
