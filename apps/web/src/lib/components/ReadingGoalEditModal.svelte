<script lang="ts">
  import { upsertReadingGoal } from "$lib/api/books";
  import { resolveApiError } from "$lib/api/errors";
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
  let saving = $state(false);
  let error = $state<string | null>(null);

  async function save() {
    const target = Number(draft);
    if (!Number.isInteger(target) || target < 1) {
      error = m.reading_goal_invalid();
      return;
    }

    saving = true;
    error = null;
    try {
      onSaved(await upsertReadingGoal({ year, target }));
      onclose();
    } catch (err) {
      error = resolveApiError(err);
    } finally {
      saving = false;
    }
  }
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
