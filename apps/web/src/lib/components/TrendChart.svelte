<script lang="ts">
  import { MONTH_YEAR_OPTIONS, formatDate, formatNumber } from "$lib/format";
  import type { TrendPeriod, TrendPointDto } from "@loomkeep/shared";

  let { points, period }: { points: TrendPointDto[]; period: TrendPeriod } =
    $props();

  // Real-pixel coordinates (width measured from the container) so circles stay
  // round — an SVG stretched with preserveAspectRatio=none squashes them.
  const H = 96;
  const PAD_Y = 12;
  const PAD_X = 8;
  const R = 4;

  let chartWidth = $state(0);

  const max = $derived(Math.max(1, ...points.map((p) => p.count)));

  const coords = $derived(
    chartWidth > 0
      ? points.map((p, i) => ({
          x:
            PAD_X +
            (i / Math.max(1, points.length - 1)) * (chartWidth - 2 * PAD_X),
          y: H - PAD_Y - (p.count / max) * (H - 2 * PAD_Y),
          point: p,
        }))
      : [],
  );

  const linePath = $derived(
    coords
      .map(
        (c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`,
      )
      .join(" "),
  );
  const areaPath = $derived(
    coords.length > 0
      ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${H - PAD_Y} L${coords[0].x.toFixed(1)},${H - PAD_Y} Z`
      : "",
  );

  const baselineY = H - PAD_Y;

  let hoverIndex = $state<number | null>(null);

  function onMove(e: PointerEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = (x - PAD_X) / Math.max(1, chartWidth - 2 * PAD_X);
    hoverIndex = Math.min(
      coords.length - 1,
      Math.max(0, Math.round(ratio * (coords.length - 1))),
    );
  }

  const DAY_MONTH_OPTIONS: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
  };
  const YEAR_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric" };

  function bucketLabel(iso: string): string {
    if (period === "day") return formatDate(iso, DAY_MONTH_OPTIONS);
    if (period === "week") return `sem. ${formatDate(iso, DAY_MONTH_OPTIONS)}`;
    if (period === "month") return formatDate(iso, MONTH_YEAR_OPTIONS);
    return formatDate(iso, YEAR_OPTIONS);
  }

  // Anchor the tooltip so it never overflows the (overflow-hidden) card: pinned
  // left near the start, right near the end, centred in between.
  function tooltipTransform(x: number): string {
    const edge = 52;
    if (x < edge) return "translateX(0)";
    if (x > chartWidth - edge) return "translateX(-100%)";
    return "translateX(-50%)";
  }
</script>

<div class="relative" bind:clientWidth={chartWidth}>
  <svg
    width={chartWidth}
    height={H}
    viewBox="0 0 {chartWidth} {H}"
    class="block"
    role="img"
    aria-label="Évolution sur la période sélectionnée"
    onpointermove={onMove}
    onpointerleave={() => (hoverIndex = null)}>
    <!-- Recessive baseline grid: two hairlines, no axis chrome. -->
    <line
      x1="0"
      y1={H / 3}
      x2={chartWidth}
      y2={H / 3}
      stroke="var(--border)"
      stroke-width="1" />
    <line
      x1="0"
      y1={(H / 3) * 2}
      x2={chartWidth}
      y2={(H / 3) * 2}
      stroke="var(--border)"
      stroke-width="1" />

    <path d={areaPath} fill="var(--accent)" opacity="0.12" />
    <path
      d={linePath}
      fill="none"
      stroke="var(--accent)"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round" />

    {#if hoverIndex !== null && coords[hoverIndex]}
      {@const h = coords[hoverIndex]}
      <line
        x1={h.x}
        y1={PAD_Y - 4}
        x2={h.x}
        y2={baselineY}
        stroke="var(--border)"
        stroke-width="1" />
    {/if}
    <!-- Endpoint dot (always) + hovered dot (when hovering) — kept as two plain
         circles rather than a keyed each, whose keys collide when the hovered
         point IS the endpoint. -->
    {#if coords.length > 0}
      {@const last = coords[coords.length - 1]}
      <circle
        cx={last.x}
        cy={last.y}
        r={R}
        fill="var(--accent)"
        stroke="var(--surface)"
        stroke-width="2" />
    {/if}
    {#if hoverIndex !== null && coords[hoverIndex]}
      {@const h = coords[hoverIndex]}
      <circle
        cx={h.x}
        cy={h.y}
        r={R}
        fill="var(--accent)"
        stroke="var(--surface)"
        stroke-width="2" />
    {/if}
  </svg>

  {#if hoverIndex !== null && coords[hoverIndex]}
    {@const h = coords[hoverIndex]}
    <div
      class="border-border bg-surface pointer-events-none absolute top-0 z-10 rounded-md border px-2 py-1 text-xs whitespace-nowrap shadow-sm"
      style="left: {h.x}px; transform: {tooltipTransform(
        h.x,
      )} translateY(calc(-100% - 6px));">
      <span class="text-fg font-semibold tabular-nums"
        >{formatNumber(h.point.count)}</span>
      <span class="text-dim"> · {bucketLabel(h.point.periodStart)}</span>
    </div>
  {/if}
</div>
