<script lang="ts">
  // What a free account sees of the premium statistics: one block, closing the
  // page. The API sends these fields empty for such an account, so the charts
  // show made-up figures, as an example.
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
</script>

<section class="card mt-10 p-5">
  <p class="flex items-center gap-2 font-semibold">
    <span
      class="bg-accent text-accent-fg grid h-7 w-7 shrink-0 place-items-center rounded-full">
      <Icon name="lock" class="h-3.5 w-3.5" />
    </span>
    {m.stats_premium_block()}
  </p>
  <div class="mt-5 grid gap-6 md:grid-cols-3" inert>
    <div>
      <h3 class="timecode mb-3 text-xs">{m.stats_rating_distribution()}</h3>
      <HistogramBars bars={RATINGS} />
    </div>
    <div>
      <h3 class="timecode mb-3 text-xs">{m.stats_decade()}</h3>
      <HistogramBars bars={DECADES} />
    </div>
    <div>
      <h3 class="timecode mb-3 text-xs">{m.stats_possession()}</h3>
      <RankBars items={POSSESSION} />
    </div>
  </div>
</section>
