<script lang="ts">
  // Single-row stacked bar + legend (domain composition, movie/series/anime
  // split…). Segments can carry a second value (e.g. time alongside count) —
  // passing `toggle` renders a small switch between the two, matching the
  // "Temps / Nombre" pattern in the video section.
  import SegmentedStatusControl from "$lib/components/SegmentedStatusControl.svelte";

  type Segment = {
    label: string;
    color: string;
    value: number;
    altValue?: number;
  };

  let {
    segments,
    toggle,
    formatValue = (n: number) => `${n}`,
  }: {
    segments: Segment[];
    toggle?: { primaryLabel: string; altLabel: string };
    formatValue?: (value: number) => string;
  } = $props();

  const canToggle = $derived(
    !!toggle && segments.every((s) => s.altValue !== undefined),
  );
  let usingAlt = $state(false);

  const active = $derived(
    segments.map((s) => ({
      ...s,
      shown: usingAlt && canToggle ? (s.altValue ?? s.value) : s.value,
    })),
  );
  const total = $derived(
    Math.max(
      1,
      active.reduce((sum, s) => sum + s.shown, 0),
    ),
  );

  type ToggleChoice = "primary" | "alt";
  const toggleMeta = $derived(
    toggle
      ? ({
          primary: { label: toggle.primaryLabel },
          alt: { label: toggle.altLabel },
        } as Record<ToggleChoice, { label: string }>)
      : undefined,
  );
</script>

{#if canToggle && toggleMeta}
  <div class="mb-3 flex justify-end">
    <div class="w-40">
      <SegmentedStatusControl
        statuses={["primary", "alt"] as ToggleChoice[]}
        current={usingAlt ? "alt" : "primary"}
        disabled={false}
        meta={toggleMeta}
        desc={{ primary: toggle!.primaryLabel, alt: toggle!.altLabel }}
        activeClass={{
          primary: "bg-surface text-fg shadow-sm",
          alt: "bg-surface text-fg shadow-sm",
        }}
        onSelect={(c) => (usingAlt = c === "alt")} />
    </div>
  </div>
{/if}

<div class="bg-surface-2 flex h-3.5 overflow-hidden rounded-full">
  {#each active as s (s.label)}
    {#if s.shown > 0}
      <div style="width:{(s.shown / total) * 100}%;background:{s.color}"></div>
    {/if}
  {/each}
</div>
<ul class="mt-3.5 flex flex-col gap-2">
  {#each active as s (s.label)}
    <li class="flex items-center gap-2.5 text-sm">
      <span class="h-3 w-3 shrink-0 rounded-sm" style="background:{s.color}"
      ></span>
      <span class="flex-1 truncate">{s.label}</span>
      <span class="timecode"
        >{formatValue(s.shown)} · {Math.round(
          (s.shown / total) * 100,
        )}&nbsp;%</span>
    </li>
  {/each}
</ul>
