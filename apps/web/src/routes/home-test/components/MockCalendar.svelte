<script lang="ts">
  // Mirrors /app/calendar: days as sections, each episode as a card row with
  // its poster, title and timecode.
  import Poster from "$lib/components/Poster.svelte";
  import { CALENDAR, COVER } from "./mock-data";
</script>

<div class="flex flex-col gap-8">
  {#each CALENDAR as day (day.label)}
    <section>
      <div class="border-border mb-3 flex items-baseline gap-3 border-b pb-2">
        <h3 class="font-display text-lg font-bold">{day.label}</h3>
        <span class="timecode text-sm">{day.date}</span>
      </div>
      <div class="flex flex-col gap-2.5">
        {#each day.items as item (item.code)}
          <div class="card flex items-center gap-4 p-3">
            <div class="w-12 shrink-0 overflow-hidden rounded-md">
              <Poster src={COVER[item.title] ?? null} title={item.title} />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-display truncate font-semibold">{item.title}</p>
              <p class="timecode text-sm">
                {item.code}{#if item.episodeTitle}
                  &nbsp;· {item.episodeTitle}{/if}
              </p>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>
