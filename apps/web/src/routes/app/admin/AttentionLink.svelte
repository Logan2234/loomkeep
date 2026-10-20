<script lang="ts">
  import Icon from "#lib/components/Icon.svelte";
  import type { IconName } from "#lib/types/icon-name.js";

  let {
    href,
    icon,
    title,
    detail,
    tone,
  }: {
    href: string;
    icon: IconName;
    title: string;
    detail: string;
    tone: "danger" | "warning";
  } = $props();
</script>

<a
  {href}
  class="group border-border/0 hover:border-border hover:bg-surface-2 focus-visible:ring-accent flex items-center gap-3 rounded-lg border px-3 py-3 transition-[background-color,border-color,transform] duration-200 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:outline-none active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none">
  <span
    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border {tone ===
    'danger'
      ? 'border-danger/25 bg-danger/10 text-danger'
      : 'border-warning/25 bg-warning/10 text-warning'}">
    <Icon name={icon} class="h-4 w-4" />
  </span>
  <span class="min-w-0 flex-1">
    <span class="text-fg block text-sm font-semibold">{title}</span>
    <span class="text-dim mt-0.5 block text-xs">{detail}</span>
  </span>
  <Icon
    name="chevron-right"
    class="text-dim h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none" />
</a>
