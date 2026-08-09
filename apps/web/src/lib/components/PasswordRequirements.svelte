<script lang="ts">
  import {
    PASSWORD_DIGIT_RE,
    PASSWORD_MIN_LENGTH,
    PASSWORD_SPECIAL_RE,
    PASSWORD_UPPERCASE_RE,
  } from "@loomkeep/shared";
  import { m } from "$lib/paraglide/messages.js";

  let { value }: { value: string } = $props();

  // Glyphs, not words: each requirement shows the character class itself
  // rather than a label naming it ("Aa" instead of "1 uppercase letter") —
  // language-neutral, so not run through Paraglide. Full sentences still
  // exist per rule (title tooltip + sr-only) for accessibility.
  const rules = $derived([
    {
      met: value.length >= PASSWORD_MIN_LENGTH,
      glyph: `${PASSWORD_MIN_LENGTH}+`,
      label: m.password_requirement_length({ min: PASSWORD_MIN_LENGTH }),
    },
    {
      met: PASSWORD_UPPERCASE_RE.test(value),
      glyph: "Aa",
      label: m.password_requirement_uppercase(),
    },
    {
      met: PASSWORD_DIGIT_RE.test(value),
      glyph: "123",
      label: m.password_requirement_digit(),
    },
    {
      met: PASSWORD_SPECIAL_RE.test(value),
      glyph: "#!?",
      label: m.password_requirement_special(),
    },
  ]);
  const metCount = $derived(rules.filter((rule) => rule.met).length);
  const complete = $derived(metCount === rules.length);
</script>

<div
  class="border-border bg-surface-2/60 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
  <div class="divide-border flex divide-x">
    {#each rules as rule (rule.glyph)}
      <div
        class="flex items-center gap-1.5 px-2.5 first:pl-0 last:pr-0"
        title={rule.label}>
        <span
          class="h-1.5 w-1.5 shrink-0 rounded-full transition-[background-color,box-shadow] duration-300 {rule.met
            ? 'bg-accent shadow-[0_0_5px_var(--color-accent)]'
            : 'bg-border'}"
          aria-hidden="true"></span>
        <span
          class="font-mono text-xs tracking-tight transition-colors {rule.met
            ? 'text-fg'
            : 'text-dim'}"
          aria-hidden="true">
          {rule.glyph}
        </span>
        <span class="sr-only">{rule.label} : {rule.met ? "✓" : "✗"}</span>
      </div>
    {/each}
  </div>
  <span class="timecode shrink-0 text-xs {complete ? 'text-accent' : ''}">
    {metCount}/{rules.length}
  </span>
  <span class="sr-only" aria-live="polite">
    {m.password_requirement_progress({ met: metCount, total: rules.length })}
  </span>
</div>
