<script lang="ts">
  // The spine of /stats: which domain's data is shown. Wraps
  // SegmentedStatusControl (dot swatch + generic segmented UI) with the
  // stats domain metadata, and only ever offers domains the user enabled —
  // a disabled domain never appears here, mirroring the API's own gating.
  import SegmentedStatusControl from "$lib/components/SegmentedStatusControl.svelte";
  import { m } from "$lib/paraglide/messages";
  import type { StatsDomain } from "@loomkeep/shared";
  import { STATS_DOMAIN_COLOR_VAR, STATS_DOMAIN_LABEL } from "./stats-domain";

  type Choice = "ALL" | StatsDomain;

  let {
    enabledDomains,
    selected,
    onSelect,
  }: {
    enabledDomains: StatsDomain[];
    selected: Choice;
    onSelect: (choice: Choice) => void;
  } = $props();

  const choices = $derived<Choice[]>(["ALL", ...enabledDomains]);
  const meta = $derived<Record<Choice, { label: string }>>(
    Object.fromEntries(
      choices.map((c) => [
        c,
        { label: c === "ALL" ? m.common_all() : STATS_DOMAIN_LABEL[c] },
      ]),
    ) as Record<Choice, { label: string }>,
  );
  const desc = $derived<Record<Choice, string>>(
    Object.fromEntries(choices.map((c) => [c, meta[c].label])) as Record<
      Choice,
      string
    >,
  );
  // Neutral active pill for every choice — identity is carried by the dot,
  // not by tinting the whole pressed segment.
  const activeClass = $derived<Record<Choice, string>>(
    Object.fromEntries(
      choices.map((c) => [c, "bg-surface text-fg shadow-sm"]),
    ) as Record<Choice, string>,
  );
  const dot = $derived<Record<Choice, string>>(
    Object.fromEntries(
      choices.map((c) => [c, c === "ALL" ? "" : STATS_DOMAIN_COLOR_VAR[c]]),
    ) as Record<Choice, string>,
  );
</script>

<SegmentedStatusControl
  statuses={choices}
  current={selected}
  disabled={false}
  {meta}
  {desc}
  {activeClass}
  {dot}
  onSelect={(c) => onSelect(c)} />
