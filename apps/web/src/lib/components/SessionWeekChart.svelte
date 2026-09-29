<script lang="ts">
  import { formatDate } from "$lib/format";
  import { formatSessionMinutes } from "$lib/session-presentation";
  import type { SessionWeekDayDto } from "@loomkeep/shared";

  let { days }: { days: SessionWeekDayDto[] } = $props();

  const maxMinutes = $derived(
    Math.max(1, ...days.map((day) => day.durationMinutes)),
  );

  function barHeight(minutes: number): number {
    if (minutes === 0) return 4;
    return Math.max(12, Math.round((minutes / maxMinutes) * 100));
  }

  function dateAtNoon(date: string): string {
    return `${date}T12:00:00.000Z`;
  }
</script>

<div class="mt-4 grid h-20 grid-cols-7 items-end gap-2" aria-hidden="true">
  {#each days as day (day.date)}
    <div class="grid h-full min-w-0 grid-rows-[1fr_auto] gap-1.5">
      <div class="flex min-h-0 items-end justify-center">
        <span
          class="bg-accent/75 block w-full max-w-11 rounded-t-md"
          style="height: {barHeight(day.durationMinutes)}%"></span>
      </div>
      <span class="timecode text-dim text-center text-[0.58rem] uppercase">
        {formatDate(dateAtNoon(day.date), {
          weekday: "narrow",
          timeZone: "UTC",
        })}
      </span>
    </div>
  {/each}
</div>

<ul class="sr-only">
  {#each days as day (day.date)}
    <li>
      {formatDate(dateAtNoon(day.date), {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      })} : {formatSessionMinutes(day.durationMinutes)}
    </li>
  {/each}
</ul>

<style>
  span[style] {
    transition: height 240ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    span[style] {
      transition: none;
    }
  }
</style>
