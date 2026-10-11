<script lang="ts">
  import { recordFrom } from "#lib/object.js";

  // Time-window filter for /stats all-time aggregates (Tout/Année/Mois/
  // Semaine). Distinct from the trend-curve period pickers (bucket size) —
  // this narrows *which* entries count, not how a curve is bucketed.
  import SegmentedStatusControl from "#lib/components/SegmentedStatusControl.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { type StatsWindow, STATS_WINDOWS } from "@loomkeep/shared";

  const LABEL: Record<StatsWindow, string> = {
    ALL: m.common_all(),
    YEAR: m.common_year(),
    MONTH: m.common_month(),
    WEEK: m.common_week(),
  };
  // Narrows the "Activité dans le temps" weekday/hour curves only (rolling
  // window: last 7/30/365 days) — the overview and Jeux/Livres/Musique
  // sections stay all-time, and the heatmap/monthly bars always show their
  // own natural full range regardless of this filter.
  const DESC: Record<StatsWindow, string> = {
    ALL: m.stats_all_history(),
    YEAR: m.stats_period_days({ period: LABEL.YEAR, days: 365 }),
    MONTH: m.stats_period_days({ period: LABEL.MONTH, days: 30 }),
    WEEK: m.stats_period_days({ period: LABEL.WEEK, days: 7 }),
  };

  let {
    selected,
    onSelect,
  }: {
    selected: StatsWindow;
    onSelect: (window: StatsWindow) => void;
  } = $props();

  const meta = recordFrom(STATS_WINDOWS, (w) => ({ label: LABEL[w] }));
  const activeClass = recordFrom(
    STATS_WINDOWS,
    () => "bg-surface text-fg shadow-sm",
  );
</script>

<SegmentedStatusControl
  statuses={[...STATS_WINDOWS]}
  current={selected}
  disabled={false}
  {meta}
  desc={DESC}
  {activeClass}
  onSelect={(w) => onSelect(w)} />
