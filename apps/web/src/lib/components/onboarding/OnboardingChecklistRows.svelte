<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { fly } from "svelte/transition";
  import {
    STEP_CONFIG,
    stepDescription,
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

  // Per-state card dressing — each is its own little "shot", not a link in a
  // list: a filled medallion for what's in the can, an open frame for what's
  // still to shoot, a dim one for what's out of reach yet.
  const CARD: Record<OnboardingStepView["state"], string> = {
    done: "border-border/60 bg-surface-2/40",
    skipped: "border-border/60 bg-surface-2/20",
    current:
      "border-accent/40 bg-accent/[0.06] hover:border-accent hover:bg-accent/10 hover:-translate-y-0.5 hover:shadow-lg",
    locked: "border-border/40 opacity-40",
  };
  const MEDALLION: Record<OnboardingStepView["state"], string> = {
    done: "border-accent bg-accent text-accent-fg",
    skipped: "border-border text-dim",
    current: "border-accent text-accent bg-accent/10",
    locked: "border-border text-dim",
  };
</script>

<ul class="flex flex-col gap-1.5">
  {#each steps as step, i (step.key)}
    {@const config = STEP_CONFIG[step.key]}
    {@const label = stepLabel(step.key)}
    <li
      in:fly={{ y: 8, duration: 220, delay: i * 35 }}
      class="group relative flex items-center gap-3 rounded-xl border p-2 transition-all duration-200 {CARD[
        step.state
      ]}">
      {#snippet content()}
        <span
          class="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200 {MEDALLION[
            step.state
          ]}">
          <Icon
            name={step.state === "done"
              ? "check"
              : step.state === "skipped"
                ? "x"
                : config.icon}
            class="h-4 w-4" />
        </span>

        <span class="min-w-0 flex-1">
          <p
            class="text-sm font-medium {step.state === 'done' ||
            step.state === 'skipped'
              ? 'text-dim line-through decoration-1'
              : step.state === 'locked'
                ? 'text-dim'
                : 'text-fg'}">
            {label}
          </p>
          {#if step.state === "current" || step.state === "locked"}
            <p class="text-dim mt-0.5 text-xs leading-snug">
              {stepDescription(step.key)}
            </p>
          {/if}
        </span>
      {/snippet}

      {#if step.state === "locked"}
        <Tooltip
          text={m.gamification_onboarding_locked()}
          placement="top"
          class="contents">
          {@render content()}
        </Tooltip>
      {:else}
        {@render content()}
      {/if}

      {#if step.state === "current"}
        <a
          href={config.href}
          aria-label={label}
          class="absolute inset-0 rounded-xl"></a>
        <Tooltip text={m.gamification_onboarding_skip()} placement="top">
          <button
            type="button"
            aria-label={m.gamification_onboarding_skip()}
            class="text-dim hover:border-border hover:text-fg hover:bg-surface relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-transparent transition-colors duration-200 disabled:opacity-50"
            disabled={busyKey === step.key}
            onclick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onSkip(step.key);
            }}>
            <Icon name="arrow-right" class="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      {/if}
    </li>
  {/each}
</ul>
