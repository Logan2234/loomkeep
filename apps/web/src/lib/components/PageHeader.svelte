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
    documentTitle,
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
    /** Overrides the <title>, for headings that don't read well in a tab
     * ("Bonsoir, Logan." on the home screen). */
    documentTitle?: string;
    class?: string;
  } = $props();
</script>

<!-- The document title rides along with the visible one: without it every
     screen under /app kept whatever <title> the previous page had set. -->
<svelte:head>
  <title>{documentTitle ?? title} · {m.common_loomkeep()}</title>
</svelte:head>

<header class="flex flex-wrap items-start justify-between gap-4 {cls}">
  <div>
    <!-- `items-start` plus a 1lh-tall slot per adornment: centring the whole
         row pushed the chevron and icon halfway down whenever the title
         wrapped to two lines, which it does on a phone ("Appareils
         connectés", "Statistiques d'instance"). The slot keeps them centred
         on the first line at both text sizes. -->
    <h1
      class="font-display flex items-start gap-2 text-3xl font-extrabold tracking-tight md:text-4xl">
      {#if back}
        <a
          href={back}
          class="text-dim hover:text-fg -ml-1 flex h-[1lh] shrink-0 items-center transition-all hover:-translate-x-0.5 hover:scale-105 active:scale-90"
          aria-label={m.common_back()}>
          <Icon name="chevron-left" class="h-6 w-6" />
        </a>
      {/if}
      {#if icon}
        <span class="flex h-[1lh] shrink-0 items-center">
          <Icon name={icon} class="text-accent h-7 w-7" />
        </span>
      {/if}
      {title}
      {#if isNew}
        <span class="flex h-[1lh] shrink-0 items-center"><NewBadge /></span>
      {/if}
    </h1>
    {#if subtitle}
      <p class="text-dim mt-1">{subtitle}</p>
    {/if}
  </div>
  {#if actions}
    {@render actions()}
  {/if}
</header>
