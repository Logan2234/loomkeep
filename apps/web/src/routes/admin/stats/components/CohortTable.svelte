<script lang="ts">
  // Monthly retention grid: one row per signup month, one column per month
  // elapsed since, cell intensity = retention %. Rows shorten as cohorts get
  // more recent (no future months), which draws the staircase.
  import type { AdminCohortRowDto } from "@loomkeep/shared";

  let { cohorts }: { cohorts: AdminCohortRowDto[] } = $props();

  const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short" });
  const width = $derived(
    Math.max(0, ...cohorts.map((c) => c.retention.length)),
  );
  const columns = $derived(Array.from({ length: width }, (_, i) => i));

  // Same ramp as the mockup: the accent tinted into the surface, flipping the
  // text colour once the fill is dark enough to swallow it.
  const background = (value: number) =>
    `color-mix(in srgb, var(--accent) ${value}%, var(--surface-2))`;
  const foreground = (value: number) =>
    value > 55 ? "var(--accent-fg)" : "var(--fg)";
</script>

{#if cohorts.length === 0}
  <p class="text-dim text-sm">Pas encore de cohorte.</p>
{:else}
  <div class="overflow-x-auto">
    <table
      class="w-full border-separate border-spacing-[3px] font-mono text-[10.5px] tabular-nums">
      <thead>
        <tr>
          <th class="text-dim p-0.5 font-normal"
            ><span class="sr-only">Mois d’inscription</span></th>
          {#each columns as c (c)}
            <th class="text-dim p-0.5 font-normal">+{c}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each cohorts as row (row.month)}
          <tr>
            <th class="text-dim p-0.5 text-right font-normal whitespace-nowrap">
              {monthFmt.format(new Date(row.month))}
              <span class="opacity-60">({row.size})</span>
            </th>
            {#each columns as c (c)}
              <td
                class="min-w-[30px] rounded px-1 py-1.5 text-center"
                style={row.retention[c] === undefined
                  ? "background:transparent"
                  : `background:${background(row.retention[c])};color:${foreground(row.retention[c])}`}>
                {row.retention[c] === undefined ? "" : row.retention[c]}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
