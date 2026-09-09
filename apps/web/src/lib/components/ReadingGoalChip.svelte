<script lang="ts">
  import { getReadingGoal } from "$lib/api/books";
  import { m } from "$lib/paraglide/messages.js";
  import type { ReadingGoalDto } from "@loomkeep/shared";
  import ReadingGoalEditModal from "./ReadingGoalEditModal.svelte";
  import ReadingGoalGauge from "./ReadingGoalGauge.svelte";

  const year = new Date().getFullYear();

  let goal = $state<ReadingGoalDto | null>(null);
  let editing = $state(false);

  $effect(() => {
    getReadingGoal(year).then((g) => (goal = g));
  });

  const hasGoal = $derived(!!goal && goal.target > 0);
</script>

{#if goal}
  <button
    type="button"
    class="chip inline-flex items-center gap-2"
    onclick={() => (editing = true)}>
    {#if hasGoal}
      <ReadingGoalGauge completed={goal.completed} target={goal.target} />
      <span class="timecode text-fg font-semibold">
        {goal.completed} / {goal.target}
      </span>
    {:else}
      {m.reading_goal_title()}
    {/if}
  </button>

  {#if editing}
    <ReadingGoalEditModal
      {year}
      {goal}
      onSaved={(g) => (goal = g)}
      onclose={() => (editing = false)} />
  {/if}
{/if}
