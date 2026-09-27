<script lang="ts">
  import NewBadge from "$lib/components/NewBadge.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { formatHours } from "$lib/format";
  import { m } from "$lib/paraglide/messages";
  import type { GameTimeToBeatDto } from "@loomkeep/shared";

  // Its own card under "Détails". Deliberately never compared
  // with the player's own playtime: someone taking their time is not "at 40 %
  // of the recommended length".
  let { timeToBeat }: { timeToBeat: GameTimeToBeatDto } = $props();

  const rows = $derived(
    [
      { label: m.game_time_to_beat_hastily(), minutes: timeToBeat.hastilyMin },
      {
        label: m.game_time_to_beat_normally(),
        minutes: timeToBeat.normallyMin,
      },
      {
        label: m.game_time_to_beat_completely(),
        minutes: timeToBeat.completelyMin,
      },
    ].flatMap(({ label, minutes }) =>
      minutes === null ? [] : [{ label, minutes }],
    ),
  );
  const longest = $derived(Math.max(...rows.map((row) => row.minutes)));
</script>

<section class="card p-4">
  <h2
    class="font-display flex items-center gap-1.5 text-sm font-bold tracking-tight">
    {m.game_time_to_beat()}
    {#if isFeatureNew("game-time-to-beat")}<NewBadge />{/if}
  </h2>
  <ul class="mt-3 flex flex-col gap-1.5">
    {#each rows as row (row.label)}
      <li
        class="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 text-sm">
        <span class="text-dim">{row.label}</span>
        <span class="bg-surface-2 h-1.5 overflow-hidden rounded-full">
          <span
            class="bg-fg/70 block h-full rounded-full"
            style:width="{Math.round((row.minutes / longest) * 100)}%"></span>
        </span>
        <span class="font-mono text-sm font-bold tabular-nums">
          {formatHours(row.minutes)}
        </span>
      </li>
    {/each}
  </ul>
  <!-- No source link here: the page's IGDB notice already credits it. -->
  <p class="text-dim text-micro mt-2">
    {m.game_time_to_beat_source({ count: timeToBeat.submissions })}
  </p>
</section>
