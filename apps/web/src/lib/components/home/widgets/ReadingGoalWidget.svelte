<script lang="ts">
  import { getReadingGoal } from "$lib/api/books";
  import ReadingGoalEditModal from "$lib/components/ReadingGoalEditModal.svelte";
  import ReadingGoalGauge from "$lib/components/ReadingGoalGauge.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { bodyOf, type BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type { ReadingGoalDto } from "@loomkeep/shared";
  import WidgetShell from "../WidgetShell.svelte";

  let { size }: { size: BoxSize } = $props();

  const def = HOME_WIDGETS.readingGoal;
  const year = new Date().getFullYear();

  let goal = $state<ReadingGoalDto | null>(null);
  let editing = $state(false);

  $effect(() => {
    getReadingGoal(year).then((g) => (goal = g));
  });

  const hasGoal = $derived(!!goal && goal.target > 0);
  const remaining = $derived(
    goal ? Math.max(0, goal.target - goal.completed) : 0,
  );

  // The gauge takes the room it's given: small beside the count in a short
  // widget, centred above it once the widget is tall.
  const body = $derived(bodyOf(size));
  const stacked = $derived(body.height >= 150);
  // Two columns leave room for the count, not the sentence under it.
  const wide = $derived(body.width >= 180);
  const gaugeSize = $derived(
    stacked
      ? Math.min(140, body.height - 70, body.width - 16)
      : Math.min(56, Math.max(36, body.height - 36)),
  );
</script>

<WidgetShell icon={def.icon} title={def.title()}>
  {#if !goal}
    <div class="flex h-full items-center gap-3">
      <div class="skeleton h-10 w-10 shrink-0 rounded-full"></div>
      <div class="skeleton h-4 w-1/3 rounded"></div>
    </div>
  {:else if hasGoal}
    <button
      type="button"
      class="hover:bg-surface-2 -m-1 flex h-[calc(100%+0.5rem)] w-[calc(100%+0.5rem)] rounded-lg p-1 text-left transition-colors {stacked
        ? 'flex-col items-center justify-center gap-2 text-center'
        : 'items-center gap-3'}"
      aria-label={m.common_edit()}
      onclick={() => (editing = true)}>
      <ReadingGoalGauge
        completed={goal.completed}
        target={goal.target}
        size={gaugeSize} />
      <span class="min-w-0">
        <span class="timecode text-fg block text-lg font-semibold">
          {goal.completed} / {goal.target}
        </span>
        {#if wide}
          <span class="text-dim block text-xs">
            {remaining > 0
              ? m.reading_goal_remaining({
                  count: remaining,
                  noun: remaining > 1 ? m.common_books() : m.common_book(),
                  year,
                })
              : m.reading_goal_reached()}
          </span>
        {/if}
      </span>
    </button>
  {:else}
    <div class="flex h-full flex-col justify-center gap-2">
      <p class="text-dim text-sm">{m.reading_goal_cta({ year })}</p>
      <button
        type="button"
        class="btn btn-ghost w-fit gap-1.5"
        onclick={() => (editing = true)}>
        {m.reading_goal_cta_action()}
      </button>
    </div>
  {/if}
</WidgetShell>

{#if editing && goal}
  <ReadingGoalEditModal
    {year}
    {goal}
    onSaved={(g) => (goal = g)}
    onclose={() => (editing = false)} />
{/if}
