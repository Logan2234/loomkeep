<script lang="ts">
  // Recurring top-of-page block: icon + title (+ optional subtitle / actions).
  // Not used by the auth pages (login/register/...), which have their own
  // centered LOOMKEEP wordmark instead of this icon+title layout.
  import type { ComponentProps, Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  type IconName = ComponentProps<typeof Icon>["name"];

  let {
    icon,
    title,
    subtitle,
    actions,
    class: cls = "mb-8",
  }: {
    icon?: IconName;
    title: string;
    subtitle?: string;
    actions?: Snippet;
    class?: string;
  } = $props();
</script>

<header class="flex items-start justify-between gap-4 {cls}">
  <div>
    <h1
      class="font-display flex items-center gap-2 text-3xl font-extrabold tracking-tight md:text-4xl">
      {#if icon}<Icon name={icon} class="text-accent h-7 w-7" />{/if}
      {title}
    </h1>
    {#if subtitle}
      <p class="text-dim mt-1">{subtitle}</p>
    {/if}
  </div>
  {#if actions}
    {@render actions()}
  {/if}
</header>
