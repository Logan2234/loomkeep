<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import {
    STEP_CONFIG,
    stepLabel,
    type OnboardingStepView,
  } from "./onboarding-checklist";

  let {
    steps,
    onSkip,
    busyKey,
  }: {
    steps: OnboardingStepView[];
    onSkip: (key: OnboardingStepView["key"]) => void;
    /** The step whose skip mutation is currently in flight, if any. */
    busyKey: string | null;
  } = $props();
</script>

<ul class="flex flex-col gap-1">
  {#each steps as step (step.key)}
    {@const config = STEP_CONFIG[step.key]}
    {@const locked = step.state === "locked"}
    <li
      class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-opacity {locked
        ? 'opacity-40'
        : ''}">
      <span
        class="grid h-7 w-7 shrink-0 place-items-center rounded-full border {step.state ===
        'done'
          ? 'border-accent bg-accent text-accent-fg'
          : step.state === 'skipped'
            ? 'border-border text-dim'
            : step.state === 'current'
              ? 'border-accent text-accent'
              : 'border-border text-dim'}">
        <Icon
          name={step.state === "done"
            ? "check"
            : step.state === "skipped"
              ? "x"
              : config.icon}
          class="h-3.5 w-3.5" />
      </span>

      {#if step.state === "current"}
        <a
          href={config.href}
          class="text-fg flex-1 text-sm font-semibold hover:underline">
          {stepLabel(step.key)}
        </a>
        <button
          type="button"
          class="text-dim hover:text-fg shrink-0 text-xs underline-offset-2 hover:underline disabled:opacity-50"
          disabled={busyKey === step.key}
          onclick={() => onSkip(step.key)}>
          {m.gamification_onboarding_skip()}
        </button>
      {:else}
        <span
          class="flex-1 text-sm {step.state === 'done' ||
          step.state === 'skipped'
            ? 'text-dim line-through'
            : 'text-fg'}"
          title={locked ? m.gamification_onboarding_locked() : undefined}>
          {stepLabel(step.key)}
        </span>
      {/if}
    </li>
  {/each}
</ul>
