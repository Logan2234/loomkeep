<script lang="ts">
  // Dashboard sidebar card for the reading goal — bigger sibling of
  // ReadingGoalChip (which stays compact, beside the /books title). Same
  // gauge + timecode fraction, but with room for a motivational line, since
  // the whole point of surfacing it on the home page is to nudge the reader.
  import { getReadingGoal } from "$lib/api/books";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
  import type { ReadingGoalDto } from "@loomkeep/shared";
  import Icon from "./Icon.svelte";
  import NewBadge from "./NewBadge.svelte";
  import ReadingGoalEditModal from "./ReadingGoalEditModal.svelte";
  import ReadingGoalGauge from "./ReadingGoalGauge.svelte";

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
</script>

{#if goal}
  <section class="card p-4">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="font-display flex items-center gap-2 text-base font-bold">
        <Icon name="gauge" class="text-accent h-4 w-4" />
        {m.reading_goal_title()}
      </h2>
      {#if hasGoal}
        <button type="button" class="btn-text" onclick={() => (editing = true)}>
          {m.common_edit()}
        </button>
      {/if}
    </div>

    {#if hasGoal}
      <div class="flex items-center gap-3">
        <ReadingGoalGauge
          completed={goal.completed}
          target={goal.target}
          size={40} />
        <p class="timecode text-fg text-lg font-semibold">
          {goal.completed} / {goal.target}
        </p>
      </div>
      <p class="text-dim mt-2 text-xs">
        {remaining > 0
          ? m.reading_goal_remaining({
              count: remaining,
              noun:
                remaining > 1
                  ? m.reading_goal_book_plural()
                  : m.reading_goal_book_singular(),
              year,
            })
          : m.reading_goal_reached()}
      </p>
    {:else}
      <p class="text-dim mb-3 text-sm">{m.reading_goal_cta({ year })}</p>
      <button
        type="button"
        class="btn btn-ghost gap-1.5"
        onclick={() => (editing = true)}>
        {m.reading_goal_cta_action()}
        {#if isFeatureNew("reading-goal")}<NewBadge />{/if}
      </button>
    {/if}
  </section>

  {#if editing}
    <ReadingGoalEditModal
      {year}
      {goal}
      onSaved={(g) => (goal = g)}
      onclose={() => (editing = false)} />
  {/if}
{/if}
