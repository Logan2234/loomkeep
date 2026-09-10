<script lang="ts">
  // [G8] Mobile half of the "Première séance" checklist: a bar docked right
  // above the bottom nav bar (not floating over content — MobileLayout
  // reserves the extra room for it, the same way it already reserves room
  // for the nav bar itself). See OnboardingWidget for the desktop half.
  import { afterNavigate } from "$app/navigation";
  import {
    getOnboardingChecklist,
    skipOnboardingStep,
  } from "$lib/api/gamification";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Drawer from "$lib/components/Drawer.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { OnboardingStepKey } from "@loomkeep/shared";
  import { deriveStepViews } from "./onboarding-checklist";
  import OnboardingChecklistRows from "./OnboardingChecklistRows.svelte";

  let open = $state(false);

  // A step's own link is a normal client-side navigation, not a call this
  // component makes itself — nothing else closes the drawer once it lands,
  // since this component stays mounted across the route change.
  afterNavigate(() => {
    open = false;
  });

  const checklistQuery = createApiQuery(() => ({
    key: keys.gamification.onboarding(),
    fetch: getOnboardingChecklist,
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

{#if steps.length > 0}
  <!-- bottom matches the 4.5rem the mobile bars themselves reserve
       (BottomNavigation/ProjectorDockMobileBar/ProgrammeBoardMobileBar), so
       this docks flush above whichever skin is active. -->
  <button
    type="button"
    onclick={() => (open = true)}
    class="border-border bg-surface active:bg-surface-2 fixed inset-x-0 z-20 flex w-full items-center gap-2.5 border-t px-4 py-2.5 text-left transition-colors duration-150"
    style="bottom: calc(4.5rem + env(safe-area-inset-bottom));">
    <span
      class="border-accent/40 bg-accent/10 grid h-8 w-8 shrink-0 place-items-center rounded-full border">
      <Icon name="flag" class="text-accent h-4 w-4" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="text-fg block text-xs font-semibold">
        {m.gamification_onboarding_checklist_title()}
      </span>
      <span class="text-dim timecode block text-[0.65rem]">
        {done} / {steps.length}
      </span>
    </span>
    <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
  </button>
{/if}

{#if open}
  <Drawer
    onclose={() => (open = false)}
    labelledby="onboarding-checklist-title">
    <div
      data-drawer-scroll
      class="touch-pan-y overflow-y-auto px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
      <h2
        id="onboarding-checklist-title"
        class="font-display mb-3 text-lg font-bold">
        {m.gamification_onboarding_checklist_title()}
      </h2>
      <OnboardingChecklistRows
        {steps}
        onSkip={skip}
        busyKey={skipMut.loading ? (skipMut.variables ?? null) : null} />
    </div>
  </Drawer>
{/if}
