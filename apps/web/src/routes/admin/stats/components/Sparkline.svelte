<script lang="ts">
  // Chart-less trend hint for a table cell: a bare polyline, no axis, no
  // labels, no tooltip. Distinct from LineChart/TrendChart on purpose — inside
  // a row there is no space for anything but the shape.
  import { m } from "$lib/paraglide/messages.js";
  import type { TrendPointDto } from "@loomkeep/shared";

  let {
    points,
    color = "var(--accent)",
  }: { points: TrendPointDto[]; color?: string } = $props();

  const W = 80;
  const H = 20;

  // Scaled between the window's own min and max: cumulative series barely move
  // in relative terms, so a zero-based scale would flatten every sparkline.
  const path = $derived.by(() => {
    if (points.length === 0) return "";
    const values = points.map((p) => p.count);
    const min = Math.min(...values);
    const span = Math.max(1, Math.max(...values) - min);
    return points
      .map((p, i) => {
        const x = points.length > 1 ? (i / (points.length - 1)) * W : W / 2;
        const y = H - 2 - ((p.count - min) / span) * (H - 4);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  });
</script>

<svg
  viewBox="0 0 {W} {H}"
  class="block h-5 w-full"
  preserveAspectRatio="none"
  role="img"
  aria-label={m.admin_sparkline_growth()}>
  <polyline fill="none" stroke={color} stroke-width="1.5" points={path} />
</svg>
