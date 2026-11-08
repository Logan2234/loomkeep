<script lang="ts">
  import { type IconName } from "#lib/types/icon-name.js";

  // Recurring top-of-page block: icon + title (+ optional subtitle / actions).
  // Not used by the auth pages (login/register/...), which have their own
  // centered LOOMKEEP wordmark instead of this icon+title layout.
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  import { page } from "$app/state";
  import { goBack, goUp } from "#lib/back-nav.svelte.js";
  import { layout } from "#lib/layout.svelte.js";
  import { mobileNav } from "#lib/mobile-nav.svelte.js";
  import { isPhoneTabRoot } from "#lib/navigation.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { fly } from "svelte/transition";
  import { m } from "#lib/paraglide/messages.js";
  import NewBadge from "./NewBadge.svelte";

  let {
    icon,
    title,
    subtitle,
    actions,
    back,
    backInHistory = false,
    backOnPhoneOnly = false,
    isNew = false,
    documentTitle,
    hero = false,
    class: cls = "mb-4 md:mb-8",
  }: {
    icon?: IconName;
    title: string;
    subtitle?: string;
    actions?: Snippet;
    /** Where the "<" leads. Set on pages reached from another one (the
     * profile hub, a settings sub-page), omitted on nav destinations. */
    back?: string;
    /** The "<" returns to the previous page instead, `back` only serving a
     * page loaded fresh: for a page reached from anywhere. */
    backInHistory?: boolean;
    /** For a page the desktop rail always reaches: no "<" there. */
    backOnPhoneOnly?: boolean;
    /** Shows a "Nouveau" pill next to the title — see feature-badges.ts. */
    isNew?: boolean;
    /** Overrides the <title>, for headings that don't read well in a tab
     * ("Bonsoir, Logan." on the home screen). */
    documentTitle?: string;
    /** Keeps the large title on a phone too: the home screen only. */
    hero?: boolean;
    class?: string;
  } = $props();

  // A phone reaches a tab's own page from the bar: no chevron there.
  const backHref = $derived(
    (backOnPhoneOnly && !layout.compact) ||
      (layout.compact && isPhoneTabRoot(page.url.pathname, mobileNav.shortcuts))
      ? undefined
      : back,
  );
  const bar = $derived(layout.compact && !hero);

  function onBack(event: MouseEvent) {
    if (backInHistory) goBack(event);
    else if (backHref) goUp(event, backHref);
  }

  // On a phone, the title and the way back stay reachable in a compact bar
  // once the header has scrolled away.
  const reduced = prefersReducedMotion();
  let header = $state<HTMLElement | null>(null);
  let scrolledAway = $state(false);

  $effect(() => {
    if (!header || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      scrolledAway =
        !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
    });
    observer.observe(header);
    return () => observer.disconnect();
  });
</script>

<!-- The document title rides along with the visible one: without it every
     screen under /app kept whatever <title> the previous page had set. -->
<svelte:head>
  <title>{documentTitle ?? title} · {m.common_loomkeep()}</title>
</svelte:head>

{#if layout.compact && scrolledAway}
  <div
    transition:fly={{ y: -8, duration: reduced ? 0 : 180 }}
    class="border-border bg-bg/95 fixed inset-x-0 top-[env(safe-area-inset-top)] z-25 flex h-12 items-center gap-2 border-b px-4 backdrop-blur">
    {#if backHref}
      <a
        href={backHref}
        onclick={onBack}
        class="text-dim relative -ml-1 flex shrink-0 items-center transition-transform after:absolute after:-inset-3 active:scale-90"
        aria-label={m.common_back()}>
        <Icon name="chevron-left" class="h-6 w-6" />
      </a>
    {/if}
    <span class="font-display min-w-0 flex-1 truncate font-bold">{title}</span>
  </div>
{/if}

{#snippet backLink(cls: string)}
  <a
    href={backHref}
    onclick={onBack}
    class="text-dim hover:text-fg relative -ml-1 flex shrink-0 items-center transition-all after:absolute after:-inset-3 hover:-translate-x-0.5 hover:scale-105 active:scale-90 {cls}"
    aria-label={back === "/app/admin"
      ? m.admin_back_to_overview()
      : m.common_back()}
    title={back === "/app/admin" ? m.admin_back_to_overview() : undefined}>
    <Icon name="chevron-left" class="h-6 w-6" />
  </a>
{/snippet}

<header bind:this={header} class={cls}>
  {#if bar}
    <!-- A phone gets an app bar, not a page title: one 56dp row with the
         actions at its end, so the content starts high on the screen. -->
    <!-- min-h, not h: with a large system font the title wraps rather
         than being cut. -->
    <div class="flex min-h-14 items-center gap-2 py-1">
      {#if backHref}{@render backLink("")}{/if}
      {#if icon}
        <Icon name={icon} class="text-accent h-5 w-5 shrink-0" />
      {/if}
      <h1
        class="font-display min-w-0 flex-1 text-xl font-extrabold tracking-tight text-balance wrap-anywhere">
        {title}
      </h1>
      {#if isNew}<NewBadge />{/if}
      {#if actions}
        <div class="flex shrink-0 items-center gap-1">{@render actions()}</div>
      {/if}
    </div>
    {#if subtitle}
      <p class="text-dim -mt-1 text-sm">{subtitle}</p>
    {/if}
  {:else}
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <!-- `items-start` plus a 1lh-tall slot per adornment: centring the
             whole row pushed the chevron and icon halfway down whenever the
             title wrapped to two lines. The slot keeps them centred on the
             first line at both text sizes. -->
        <div class="flex items-start gap-2 text-3xl md:text-4xl">
          {#if backHref}{@render backLink("h-lh")}{/if}
          {#if icon}
            <span class="flex h-lh shrink-0 items-center">
              <Icon name={icon} class="text-accent h-7 w-7" />
            </span>
          {/if}
          <h1 class="font-display min-w-0 font-extrabold tracking-tight">
            {title}
          </h1>
          {#if isNew}
            <span class="flex h-lh shrink-0 items-center"><NewBadge /></span>
          {/if}
        </div>
        {#if subtitle}
          <p class="text-dim mt-1">{subtitle}</p>
        {/if}
      </div>
      {#if actions}
        {@render actions()}
      {/if}
    </div>
  {/if}
</header>
