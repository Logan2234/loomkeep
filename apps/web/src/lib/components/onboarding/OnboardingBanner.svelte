<script lang="ts">
  // [G8] Mobile half of the "Première séance" checklist. Deliberately an
  // in-flow banner (mounted at the top of MobileLayout's <main>, pushing
  // content down) rather than a fixed floating element: the mobile audit
  // just replaced NotificationBell's old floating corner button for exactly
  // that reason — see NotificationTab's own comment on why nothing reserved
  // space for it. This one does.
  import {
    getOnboardingChecklist,
    skipOnboardingStep,
  } from "$lib/api/gamification";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { OnboardingStepKey } from "@loomkeep/shared";
  import { deriveStepViews } from "./onboarding-checklist";
  import OnboardingChecklistRows from "./OnboardingChecklistRows.svelte";
  import Drawer from "$lib/components/Drawer.svelte";

  let open = $state(false);

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
  <button
    type="button"
    onclick={() => (open = true)}
    class="border-border bg-surface flex w-full items-center gap-2 border-b px-4 py-2.5 text-left">
    <Icon name="flag" class="text-accent h-4 w-4 shrink-0" />
    <span class="text-fg flex-1 text-xs font-semibold">
      {m.gamification_onboarding_checklist_title()}
    </span>
    <span class="text-dim text-xs font-semibold">{done} / {steps.length}</span>
    <Icon name="chevron-right" class="text-dim h-3.5 w-3.5 shrink-0" />
  </button>
{/if}

{#if open}
  <Drawer
    onclose={() => (open = false)}
    labelledby="onboarding-checklist-title">
    <h2
      id="onboarding-checklist-title"
      class="font-display mb-3 text-lg font-bold">
      {m.gamification_onboarding_checklist_title()}
    </h2>
    <OnboardingChecklistRows
      {steps}
      onSkip={skip}
      busyKey={skipMut.loading ? (skipMut.variables ?? null) : null} />
  </Drawer>
{/if}
