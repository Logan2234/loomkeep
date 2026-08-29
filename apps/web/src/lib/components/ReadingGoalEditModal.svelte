<script lang="ts">
  import { upsertReadingGoal } from "$lib/api/books";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { ReadingGoalDto } from "@loomkeep/shared";
  import Modal from "./Modal.svelte";

  let {
    year,
    goal,
    onSaved,
    onclose,
  }: {
    year: number;
    goal: ReadingGoalDto | null;
    onSaved: (goal: ReadingGoalDto) => void;
    onclose: () => void;
  } = $props();

  let draft = $state(goal?.target ? String(goal.target) : "");
  let localError = $state<string | null>(null);

  const saveMut = createApiMutation(() => ({
    mutate: (target: number) => upsertReadingGoal({ year, target }),
    coveredFields: ["target"],
    onSuccess: (goal) => {
      onSaved(goal);
      onclose();
    },
  }));

  function save() {
    const target = Number(draft);
    if (!Number.isInteger(target) || target < 1) {
      localError = m.reading_goal_invalid();
      return;
    }
    localError = null;
    saveMut.mutate(target);
  }

  const saving = $derived(saveMut.loading);
  const error = $derived(localError ?? saveMut.error);
</script>

<Modal title={m.reading_goal_modal_title({ year })} {onclose}>
  <form
    class="flex flex-col gap-3"
    onsubmit={(e) => {
      e.preventDefault();
      void save();
    }}>
    <label class="flex flex-col gap-1.5 text-sm" for="reading-goal-target">
      {m.reading_goal_label()}
      <input
        id="reading-goal-target"
        type="number"
        min="1"
        max="1000"
        class="input"
        bind:value={draft} />
    </label>
    {#if error}
      <p class="text-danger text-xs">{error}</p>
    {/if}
    <div class="mt-2 flex justify-end gap-2">
      <button type="button" class="btn btn-ghost" onclick={onclose}>
        {m.common_cancel()}
      </button>
      <button class="btn btn-primary" disabled={saving} type="submit">
        {saving ? m.common_save_loading() : m.common_save()}
      </button>
    </div>
  </form>
</Modal>
