<script lang="ts">
  // Recurring top-of-page block: icon + title (+ optional subtitle / actions).
  // Not used by the auth pages (login/register/...), which have their own
  // centered LOOMKEEP wordmark instead of this icon+title layout.
  import type { ComponentProps, Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  type IconName = ComponentProps<typeof Icon>["name"];

  import { m } from "$lib/paraglide/messages.js";
  import NewBadge from "./NewBadge.svelte";

  let {
    icon,
    title,
    subtitle,
    actions,
    back,
    isNew = false,
    class: cls = "mb-8",
  }: {
    icon?: IconName;
    title: string;
    subtitle?: string;
    actions?: Snippet;
    /** Where the "<" leads. Set on pages reached from another one (the
     * profile hub, a settings sub-page), omitted on nav destinations. */
    back?: string;
    /** Shows a "Nouveau" pill next to the title — see feature-badges.ts. */
    isNew?: boolean;
    class?: string;
  } = $props();
</script>

<header class="flex flex-wrap items-start justify-between gap-4 {cls}">
  <div>
    <h1
      class="font-display flex items-center gap-2 text-3xl font-extrabold tracking-tight md:text-4xl">
      {#if back}
        <a
          href={back}
          class="text-dim hover:text-fg -ml-1 shrink-0 transition-all hover:-translate-x-0.5 hover:scale-105 active:scale-90"
          aria-label={m.common_back()}>
          <Icon name="chevron-left" class="h-6 w-6" />
        </a>
      {/if}
      {#if icon}<Icon name={icon} class="text-accent h-7 w-7" />{/if}
      {title}
      {#if isNew}<NewBadge />{/if}
    </h1>
    {#if subtitle}
      <p class="text-dim mt-1">{subtitle}</p>
    {/if}
  </div>
  {#if actions}
    {@render actions()}
  {/if}
</header>
