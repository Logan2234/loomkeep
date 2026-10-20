<script lang="ts">
  import RollingNumber from "./RollingNumber.svelte";

  let {
    value = $bindable(),
    label,
    min,
    max,
    disabled = false,
    class: className = "",
    numberClass = "text-5xl",
  }: {
    value: number;
    label: string;
    min: number;
    max?: number;
    disabled?: boolean;
    class?: string;
    numberClass?: string;
  } = $props();

  function normalizeValue(candidate: number) {
    const finiteValue = Number.isFinite(candidate) ? candidate : min;
    return Math.min(
      max ?? Number.POSITIVE_INFINITY,
      Math.max(min, Math.trunc(finiteValue)),
    );
  }

  let focused = $state(false);
  let draft = $state(String(normalizeValue(value)));
  let displayValue = $derived(normalizeValue(value));

  $effect(() => {
    if (!focused) {
      const normalized = normalizeValue(value);
      if (!Object.is(value, normalized)) value = normalized;
      draft = String(normalized);
    }
  });

  function beginEditing() {
    draft = String(normalizeValue(value));
    focused = true;
  }

  function updateDraft(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const digits = input.value.replace(/\D/g, "");
    const parsed = digits ? normalizeValue(Number(digits)) : null;
    draft = parsed === null ? "" : String(parsed);
    input.value = draft;
    if (parsed !== null) value = parsed;
  }

  function finishEditing() {
    value = normalizeValue(draft ? Number(draft) : min);
    draft = String(value);
    focused = false;
  }
</script>

<span
  class="focus-within:border-accent/65 focus-within:bg-bg focus-within:ring-accent/15 relative inline-grid rounded-xl border border-transparent bg-transparent transition-[background-color,border-color,box-shadow] focus-within:ring-4 {className}">
  <input
    class="number-input font-display text-fg h-full w-full rounded-xl border-0 bg-transparent px-2 text-center leading-none font-extrabold tracking-tight tabular-nums outline-none [grid-area:1/1] {numberClass}"
    class:text-transparent={!focused}
    type="text"
    inputmode="numeric"
    pattern="[0-9]*"
    aria-label={label}
    value={draft}
    {disabled}
    onfocus={beginEditing}
    oninput={updateDraft}
    onblur={finishEditing} />
  <span
    aria-hidden="true"
    class="font-display text-fg pointer-events-none z-10 flex items-center justify-center px-2 leading-none font-extrabold tracking-tight tabular-nums transition-opacity [grid-area:1/1] {numberClass}"
    class:opacity-0={focused}>
    <RollingNumber value={displayValue} />
  </span>
</span>
