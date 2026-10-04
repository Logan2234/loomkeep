<script lang="ts">
  type Marker = { kind: "danger" | "warning"; label: string };
  type Item = {
    id: string;
    label: string;
    href: string;
    prefix?: string;
    markers?: Marker[];
  };

  let {
    label,
    items,
    activeId,
  }: { label: string; items: Item[]; activeId: string } = $props();
</script>

<nav
  aria-label={label}
  class="no-scrollbar relative flex gap-2 overflow-x-auto lg:max-h-[calc(100dvh-4rem)] lg:flex-col lg:gap-0 lg:overflow-y-auto">
  {#each items as item (item.id)}
    {@const active = activeId === item.id}
    <a
      href={item.href}
      aria-label={item.label}
      aria-describedby={item.markers?.length
        ? `section-rail-${item.id}`
        : undefined}
      aria-current={active ? "location" : undefined}
      class="relative flex shrink-0 items-center gap-2 rounded-lg py-1.5 pr-2 pl-3 text-sm transition-colors lg:shrink {active
        ? 'text-fg bg-accent/10 before:bg-accent font-semibold before:absolute before:inset-y-0 before:left-0 before:hidden before:w-0.5 lg:before:block'
        : 'text-dim hover:text-fg hover:bg-surface-2'}">
      {#if item.prefix}<span
          class="timecode shrink-0 text-xs"
          aria-hidden="true">{item.prefix}</span
        >{/if}
      <span class="min-w-0 flex-1 truncate" title={item.label}
        >{item.label}</span>
      {#each item.markers ?? [] as marker (marker.kind)}
        <span
          title={marker.label}
          aria-hidden="true"
          class="h-1.5 w-1.5 shrink-0 rounded-full {marker.kind === 'danger'
            ? 'bg-danger'
            : 'bg-warning'}"></span>
      {/each}
    </a>
    {#if item.markers?.length}
      <span id={`section-rail-${item.id}`} class="sr-only">
        {item.markers.map((marker) => marker.label).join(", ")}
      </span>
    {/if}
  {/each}
</nav>
