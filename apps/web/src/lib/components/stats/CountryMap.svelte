<script lang="ts">
  import SegmentedStatusControl from "#lib/components/SegmentedStatusControl.svelte";
  import { formatHours, formatRegion } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { VideoCountryDto } from "@loomkeep/shared/contracts";
  import { onMount } from "svelte";
  import RankBars from "./RankBars.svelte";
  import { countryShade } from "./country-map.js";

  // Where the films and series someone watched come from: a choropleth next
  // to the full ranking, which also carries the countries too small to draw
  // (Singapore, Malta) and is what a screen reader reads. The hovered country
  // is outlined rather than the others dimmed: dimming washed the whole map
  // out whenever the hovered country was a pale one.
  let { countries }: { countries: VideoCountryDto[] } = $props();

  type Metric = "titles" | "minutes";
  let metric = $state<Metric>("titles");

  // ~80 kB of paths, fetched only once the stats page shows the section.
  let map = $state<{
    width: number;
    height: number;
    countries: Record<string, string>;
  } | null>(null);
  onMount(() => {
    void import("./world-map.json").then((module) => (map = module.default));
  });

  const byCode = $derived(new Map(countries.map((c) => [c.country, c])));
  const max = $derived(Math.max(1, ...countries.map((c) => c[metric])));

  const titlesLabel = (count: number) =>
    count === 1
      ? m.stats_video_country_titles_one({ count })
      : m.stats_video_country_titles_many({ count });
  const valueLabel = (c: VideoCountryDto, by: Metric) =>
    by === "titles" ? titlesLabel(c.titles) : formatHours(c.minutes);

  const items = $derived(
    [...countries]
      .sort((a, b) => b[metric] - a[metric])
      .map((c) => ({
        label: formatRegion(c.country),
        value: c[metric],
        display: valueLabel(c, metric),
      })),
  );

  let hovered = $state<string | null>(null);
  const hoveredCountry = $derived(hovered ? byCode.get(hovered) : undefined);
</script>

<div class="mb-3 flex justify-end">
  <div class="w-40">
    <SegmentedStatusControl
      statuses={["titles", "minutes"] as Metric[]}
      current={metric}
      disabled={false}
      meta={{
        titles: { label: m.common_count() },
        minutes: { label: m.common_time() },
      }}
      desc={{ titles: m.common_count(), minutes: m.common_time() }}
      activeClass={{
        titles: "bg-surface text-fg shadow-sm",
        minutes: "bg-surface text-fg shadow-sm",
      }}
      onSelect={(choice) => (metric = choice)} />
  </div>
</div>

<div class="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
  <div class="flex min-w-0 flex-col justify-center gap-2">
    {#if map}
      <svg
        viewBox="0 0 {map.width} {map.height}"
        class="h-auto w-full"
        aria-hidden="true"
        onpointerover={(event) => {
          const code = (event.target as Element).getAttribute("data-code");
          hovered = code && byCode.has(code) ? code : null;
        }}
        onpointerleave={() => (hovered = null)}>
        {#each Object.entries(map.countries) as [code, d] (code)}
          {@const country = byCode.get(code)}
          <path
            {d}
            data-code={code}
            fill={country
              ? countryShade(country[metric], max)
              : "var(--surface-2)"}
            stroke="var(--surface)"
            stroke-width="0.6"
            stroke-linejoin="round" />
        {/each}
        {#if hovered}
          <path
            d={map.countries[hovered]}
            fill="none"
            stroke="var(--fg)"
            stroke-width="1.6"
            stroke-linejoin="round"
            pointer-events="none" />
        {/if}
      </svg>
    {:else}
      <div class="bg-surface-2 aspect-[2/1] w-full animate-pulse rounded-lg">
      </div>
    {/if}
    <p class="text-dim min-h-5 text-sm" aria-hidden="true">
      {#if hoveredCountry}
        <span class="text-fg font-semibold">
          {formatRegion(hoveredCountry.country)}
        </span>
        · {titlesLabel(hoveredCountry.titles)} · {formatHours(
          hoveredCountry.minutes,
        )}
      {:else}
        {m.stats_video_countries_hint()}
      {/if}
    </p>
  </div>
  <div class="min-w-0">
    <RankBars {items} initialCount={8} />
  </div>
</div>
