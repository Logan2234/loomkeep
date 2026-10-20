<script lang="ts" module>
  import type { ChatFormat } from "#lib/chat/chat-markdown.js";
  import { selectionFormats } from "#lib/chat/chat-markdown.js";

  export interface SelectionBar {
    left: number;
    top: number;
    active: ChatFormat[];
  }

  /** What the bar needs to know of a composer's field (see MarkdownField). */
  interface Field {
    hasFocus(): boolean;
    selection(): { start: number; end: number };
    coordsAt(offset: number): { left: number; top: number } | null;
  }

  /** Where the bar goes over a field's selection, or null without one. */
  export function selectionBarAt(
    field: Field | null,
    value: string,
  ): SelectionBar | null {
    if (!field?.hasFocus()) return null;
    const { start, end } = field.selection();
    if (start === end) return null;

    const from = field.coordsAt(start);
    const to = field.coordsAt(end);
    if (!from || !to) return null;
    const middle =
      from.top === to.top ? (from.left + to.left) / 2 : from.left + 60;
    return {
      left: Math.max(8, Math.min(middle - 110, innerWidth - 228)),
      top: Math.max(8, from.top - 46),
      active: selectionFormats(value, start, end),
    };
  }
</script>

<script lang="ts">
  // The bar over a selection in a composer: Messages' and a work's comments'.
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { scale } from "svelte/transition";

  let {
    bar,
    onformat,
  }: { bar: SelectionBar; onformat: (kind: ChatFormat) => void } = $props();

  const reduced = prefersReducedMotion();

  const FORMATS: { kind: ChatFormat; glyph: string; label: string }[] = [
    { kind: "bold", glyph: "B", label: m.chat_format_bold() },
    { kind: "italic", glyph: "I", label: m.chat_format_italic() },
    { kind: "strike", glyph: "S", label: m.chat_format_strike() },
    { kind: "code", glyph: "</>", label: m.chat_format_code() },
  ];
</script>

<div
  transition:scale={{ duration: reduced ? 0 : 120, start: 0.95 }}
  role="toolbar"
  aria-label={m.chat_formatting()}
  class="bg-fg text-bg fixed z-[70] flex items-center gap-0.5 rounded-xl p-1 shadow-lg"
  style="left: {bar.left}px; top: {bar.top}px;">
  {#each FORMATS as item (item.kind)}
    {@const pressed = bar.active.includes(item.kind)}
    <button
      type="button"
      class="grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-sm font-bold transition-colors duration-150
        {pressed ? 'bg-bg/25 text-accent' : 'hover:bg-bg/15'}"
      aria-label={item.label}
      aria-pressed={pressed}
      title={item.label}
      onmousedown={(e) => e.preventDefault()}
      onclick={() => onformat(item.kind)}>
      <span
        class={item.kind === "italic"
          ? "italic"
          : item.kind === "strike"
            ? "line-through"
            : item.kind === "code"
              ? "font-mono text-xs"
              : ""}>{item.glyph}</span>
    </button>
  {/each}
  <span class="bg-bg/25 mx-0.5 h-5 w-px"></span>
  <button
    type="button"
    class="bg-accent text-accent-fg grid h-8 w-8 place-items-center rounded-lg transition-[filter,box-shadow] duration-150 hover:brightness-110
      {bar.active.includes('spoiler') ? 'ring-bg ring-2 ring-inset' : ''}"
    aria-label={m.chat_format_spoiler()}
    aria-pressed={bar.active.includes("spoiler")}
    title={m.chat_format_spoiler()}
    onmousedown={(e) => e.preventDefault()}
    onclick={() => onformat("spoiler")}>
    <Icon name="eye-off" class="h-4 w-4" />
  </button>
</div>
