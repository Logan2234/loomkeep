<script lang="ts">
  import {
    PASSWORD_DIGIT_RE,
    PASSWORD_MIN_LENGTH,
    PASSWORD_SPECIAL_RE,
    PASSWORD_UPPERCASE_RE,
  } from "@loomkeep/shared";
  import { m } from "$lib/paraglide/messages.js";
  import Icon from "./Icon.svelte";

  let { value }: { value: string } = $props();

  const rules = $derived([
    {
      met: value.length >= PASSWORD_MIN_LENGTH,
      label: m.password_requirement_length({ min: PASSWORD_MIN_LENGTH }),
    },
    {
      met: PASSWORD_UPPERCASE_RE.test(value),
      label: m.password_requirement_uppercase(),
    },
    {
      met: PASSWORD_DIGIT_RE.test(value),
      label: m.password_requirement_digit(),
    },
    {
      met: PASSWORD_SPECIAL_RE.test(value),
      label: m.password_requirement_special(),
    },
  ]);
  const metCount = $derived(rules.filter((rule) => rule.met).length);
</script>

<div class="flex flex-wrap items-center gap-1.5">
  {#each rules as rule (rule.label)}
    <span
      class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors {rule.met
        ? 'border-accent bg-accent text-accent-fg'
        : 'border-border text-dim'}">
      {#if rule.met}<Icon name="check" class="h-3 w-3" />{/if}
      {rule.label}
    </span>
  {/each}
  <span class="timecode ml-auto text-xs">{metCount}/{rules.length}</span>
  <span class="sr-only" aria-live="polite">
    {m.password_requirement_progress({ met: metCount, total: rules.length })}
  </span>
</div>
