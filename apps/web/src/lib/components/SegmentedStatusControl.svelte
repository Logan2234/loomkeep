<script lang="ts" generics="T extends string">
  // Segmented status picker shared by books and games (media's status is
  // server-derived, not user-selectable this way).
  let {
    statuses,
    current,
    disabled,
    meta,
    desc,
    activeClass,
    dot,
    onSelect,
  }: {
    statuses: T[];
    current: T;
    disabled: boolean;
    meta: Record<T, { label: string }>;
    desc: Record<T, string>;
    activeClass: Record<T, string>;
    // Optional per-value swatch color (CSS color), e.g. a domain's stat hue.
    // Absent by default — existing status pickers render no dot.
    dot?: Record<T, string>;
    onSelect: (status: T) => void;
  } = $props();
</script>

<div
  class="border-border bg-surface-2 grid gap-1 rounded-xl border p-1"
  style="grid-template-columns: repeat({statuses.length}, minmax(0, 1fr));"
  role="group"
  aria-label="Statut">
  {#each statuses as status (status)}
    <button
      type="button"
      aria-pressed={current === status}
      {disabled}
      title={desc[status]}
      class="inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors disabled:cursor-default disabled:opacity-40 {current ===
      status
        ? activeClass[status]
        : 'text-dim hover:text-fg'}"
      onclick={() => onSelect(status)}>
      {#if dot?.[status]}
        <span
          class="h-2 w-2 shrink-0 rounded-full"
          style="background:{dot[status]}"
          aria-hidden="true"></span>
      {/if}
      {meta[status].label}
    </button>
  {/each}
</div>
