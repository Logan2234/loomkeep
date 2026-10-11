<script lang="ts">
  import type { HTMLAnchorAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";
  import type { IconName } from "#lib/types/icon-name.js";
  import Icon from "#lib/components/Icon.svelte";
  let {
    icon,
    children,
    iconClass = "text-accent h-5 w-5 shrink-0",
    chevronClass = "text-dim h-5 w-5 shrink-0",
    class:
      className = "hover:bg-surface-2 flex items-center gap-3 px-4 py-3.5 transition-colors",
    ...link
  }: {
    icon: IconName;
    children: Snippet;
    iconClass?: string;
    chevronClass?: string;
  } & HTMLAnchorAttributes = $props();
</script>

<a {...link} class={className}>
  <Icon name={icon} class={iconClass} />
  {@render children()}
  <Icon name="chevron-right" class={chevronClass} />
</a>
