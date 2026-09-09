<script lang="ts">
  // [G8] Desktop half of the "Première séance" checklist: a small collapsed
  // pill, bottom-right, that unfolds into the step list on click — see
  // OnboardingBanner for the mobile half (a different shell entirely, not
  // just a responsive variant of this one).
  import {
    getOnboardingChecklist,
    skipOnboardingStep,
  } from "$lib/api/gamification";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { layout } from "$lib/layout.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { OnboardingStepKey } from "@loomkeep/shared";
  import { fade, scale } from "svelte/transition";
  import { deriveStepViews } from "./onboarding-checklist";
  import OnboardingChecklistRows from "./OnboardingChecklistRows.svelte";

  let open = $state(false);

  const checklistQuery = createApiQuery(() => ({
    key: keys.gamification.onboarding(),
    fetch: getOnboardingChecklist,
    // Steps only ever change from the user's own actions elsewhere in the
    // app, which this panel can't observe directly — a modest poll instead
    // of wiring an invalidation into every add/rate/import/comment call
    // site across the app. Stops once there's nothing left to poll for.
    refetchInterval: (data) => (data?.allDone ? false : 30_000),
  }));

  const steps = $derived(
    checklistQuery.data ? deriveStepViews(checklistQuery.data.steps) : [],
  );
  const done = $derived(
    steps.filter((s) => s.state !== "locked" && s.state !== "current").length,
  );

  const skipMut = createApiMutation(() => ({
    mutate: (key: OnboardingStepKey) => skipOnboardingStep(key),
    invalidates: [keys.gamification.onboarding()],
  }));

  function skip(key: OnboardingStepKey) {
    skipMut.mutate(key);
  }
</script>

{#if steps.length > 0 && !layout.compact}
  <!-- bottom-24 clears the Quackback feedback launcher (WidgetIdentify.svelte),
       a fixed 48px bubble sitting ~26px off the bottom edge in the same corner. -->
  <div class="fixed right-4 bottom-24 z-30">
    {#if open}
      <div
        transition:scale={{ duration: 150, start: 0.95 }}
        class="card border-border mb-2 w-72 border p-3 shadow-lg">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="font-display text-sm font-bold">
            {m.gamification_onboarding_checklist_title()}
          </h2>
          <button
            type="button"
            aria-label={m.common_close()}
            class="text-dim hover:text-fg"
            onclick={() => (open = false)}>
            <Icon name="x" class="h-4 w-4" />
          </button>
        </div>
        <OnboardingChecklistRows
          {steps}
          onSkip={skip}
          busyKey={skipMut.loading ? (skipMut.variables ?? null) : null} />
      </div>
    {/if}

    <button
      type="button"
      onclick={() => (open = !open)}
      transition:fade={{ duration: 150 }}
      class="border-border bg-surface text-fg hover:bg-surface-2 flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-lg">
      <Icon name="flag" class="h-4 w-4" />
      {done} / {steps.length}
    </button>
  </div>
{/if}
