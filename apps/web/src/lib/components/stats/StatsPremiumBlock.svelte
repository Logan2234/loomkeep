<script lang="ts">
  // What a free account sees of the premium statistics, closing the page: a
  // sentence, then blurred blocks under a lock. The API sends these fields empty
  // for such an account, so the shapes behind the blur are made up.
  import Icon from "#lib/components/Icon.svelte";
  import HistogramBars from "#lib/components/stats/HistogramBars.svelte";
  import RankBars from "#lib/components/stats/RankBars.svelte";
  import { m } from "#lib/paraglide/messages.js";

  const RATINGS = [2, 3, 5, 8, 12, 15, 11, 9, 6, 3].map((value, i) => ({
    label: String(i + 1),
    value,
  }));
  const DECADES = [
    { label: "1990", value: 4 },
    { label: "2000", value: 9 },
    { label: "2010", value: 14 },
    { label: "2020", value: 7 },
  ];
  const POSSESSION = [
    { label: m.stats_ownership_owned(), value: 18 },
    { label: m.ownership_borrowed(), value: 6 },
    { label: m.ownership_streaming(), value: 11 },
  ];
  const ACTIVITY = [4, 7, 3, 9, 12, 6, 8, 14, 10, 5, 11, 7].map((value, i) => ({
    label: String(i + 1),
    value,
  }));
</script>

{#snippet locked(title: string, preview: import("svelte").Snippet)}
  <div class="card relative overflow-hidden p-4">
    <div class="blur-sm select-none" inert aria-hidden="true">
      <p class="timecode mb-3 text-xs">{title}</p>
      {@render preview()}
    </div>
    <span
      class="bg-accent text-accent-fg absolute top-1/2 left-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full">
      <Icon name="lock" class="h-4 w-4" />
    </span>
  </div>
{/snippet}

{#snippet ratings()}<HistogramBars bars={RATINGS} />{/snippet}
{#snippet decades()}<HistogramBars bars={DECADES} />{/snippet}
{#snippet possession()}<RankBars items={POSSESSION} />{/snippet}
{#snippet activity()}<HistogramBars bars={ACTIVITY} />{/snippet}

<section class="mt-10">
  <p class="font-semibold">{m.stats_premium_block()}</p>
  <div class="mt-4 grid gap-4 md:grid-cols-2">
    {@render locked(m.stats_rating_distribution(), ratings)}
    {@render locked(m.stats_decade(), decades)}
    {@render locked(m.stats_possession(), possession)}
    {@render locked(m.stats_temporal_section(), activity)}
  </div>
</section>
