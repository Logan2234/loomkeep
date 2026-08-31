<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  // Single-series line chart over an SVG viewbox — reusable for any
  // {label,value}[] series (weekday/hour curves, monthly minutes…). Shows a
  // handful of evenly-spaced x-axis labels regardless of point count.
  let {
    points,
    color = "var(--accent)",
    height = 120,
    labelCount = 4,
  }: {
    points: { label: string; value: number }[];
    color?: string;
    height?: number;
    labelCount?: number;
  } = $props();

  const WIDTH = 320;
  const max = $derived(Math.max(1, ...points.map((p) => p.value)));

  const coords = $derived(
    points.map((p, i) => ({
      x: points.length > 1 ? (i / (points.length - 1)) * WIDTH : WIDTH / 2,
      y: height - (p.value / max) * (height - 8) - 2,
    })),
  );

  const path = $derived(coords.map((c) => `${c.x},${c.y}`).join(" "));

  const areaPath = $derived(
    coords.length > 0
      ? `M${coords[0].x},${height} L${path.split(" ").join(" L")} L${coords[coords.length - 1].x},${height} Z`
      : "",
  );

  const labelIndexes = $derived.by(() => {
    if (points.length === 0) return [];
    if (points.length <= labelCount) return points.map((_, i) => i);
    const step = (points.length - 1) / (labelCount - 1);
    return Array.from({ length: labelCount }, (_, i) => Math.round(i * step));
  });
</script>

<svg
  viewBox="0 0 {WIDTH} {height}"
  width="100%"
  {height}
  preserveAspectRatio="none"
  role="img"
  aria-label={m.stats_line_chart()}>
  {#if areaPath}
    <path d={areaPath} fill={color} opacity="0.12" />
  {/if}
  <polyline fill="none" stroke={color} stroke-width="2" points={path} />
</svg>
<div class="text-dim mt-1 flex justify-between text-[11px]">
  {#each labelIndexes as i (i)}
    <span>{points[i]?.label}</span>
  {/each}
</div>
