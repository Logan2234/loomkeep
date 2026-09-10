<script lang="ts">
  // [G8] Desktop half of the "Première séance" checklist: a small collapsed
  // ticket-stub pill, bottom-right, that unfolds into the step list on click
  // — see OnboardingBanner for the mobile half (a different shell entirely,
  // not just a responsive variant of this one).
  import { afterNavigate } from "$app/navigation";
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
  import { fly } from "svelte/transition";
  import { deriveStepViews } from "./onboarding-checklist";
  import OnboardingChecklistRows from "./OnboardingChecklistRows.svelte";

  let open = $state(false);

  // A step's own link is a normal client-side navigation, not a call this
  // component makes itself — nothing else closes the popover once it lands,
  // since this component stays mounted across the route change.
  afterNavigate(() => {
    open = false;
  });

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
  <!-- items-end keeps the pill glued to the right edge regardless of the
       panel's own width — a plain block stack let the panel's 18rem width
       drag the pill along with it, so closing the panel visibly snapped the
       pill back rightward. bottom-24 clears the Quackback feedback launcher
       (WidgetIdentify.svelte), a fixed 48px bubble ~26px off the bottom edge
       in the same corner. -->
  <div class="fixed right-4 bottom-24 z-30 flex flex-col items-end gap-2">
    {#if open}
      <div
        transition:fly={{ duration: 220, y: 12, opacity: 0 }}
        style="transform-origin: bottom right;"
        class="border-border bg-surface w-96 overflow-hidden rounded-2xl border shadow-2xl">
        <div class="relative overflow-hidden px-4 pt-3.5 pb-3">
          <!-- Letterbox hairline + a soft amber wash behind the title, the
               same "marquee" language the rating cartouche uses elsewhere. -->
          <div
            class="from-accent/15 pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent">
          </div>
          <div class="relative flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon name="flag" class="text-accent h-4 w-4" />
              <h2 class="font-display text-sm font-bold tracking-tight">
                {m.gamification_onboarding_checklist_title()}
              </h2>
            </div>
            <button
              type="button"
              aria-label={m.common_close()}
              class="text-dim hover:text-fg hover:bg-surface-2 grid h-6 w-6 place-items-center rounded-full transition-colors"
              onclick={() => (open = false)}>
              <Icon name="x" class="h-3.5 w-3.5" />
            </button>
          </div>
          <p class="timecode text-dim relative mt-1 text-xs">
            {done} / {steps.length}
          </p>
        </div>
        <div class="border-border border-t p-2.5">
          <OnboardingChecklistRows
            {steps}
            onSkip={skip}
            busyKey={skipMut.loading ? (skipMut.variables ?? null) : null} />
        </div>
      </div>
    {/if}

    <button
      type="button"
      onclick={() => (open = !open)}
      aria-expanded={open}
      class="border-border bg-surface text-fg hover:border-accent hover:text-accent hover:shadow-accent/20 group flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
      <Icon
        name="flag"
        class="text-dim group-hover:text-accent h-4 w-4 transition-colors duration-200" />
      <span class="timecode">{done} / {steps.length}</span>
    </button>
  </div>
{/if}
