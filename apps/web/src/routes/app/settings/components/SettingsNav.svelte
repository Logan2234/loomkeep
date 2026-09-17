<script module lang="ts">
  let persistedIndicator: { top: number; height: number } | null = null;
</script>

<script lang="ts">
  // The five groups, rendered twice: as the desktop rail and as the phone
  // index. The rail's highlight is one tinted pill that slides between
  // entries, measured off `aria-current="page"` — the same mechanism as the
  // global sidebar's, so the two rails behave alike when they sit together.
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { tick } from "svelte";
  import { settingsShortcutLabel } from "../keyboard-navigation";
  import { SETTINGS_GROUPS, sectionHref } from "../nav";
  import { settingsSearch } from "../search-state.svelte";

  let {
    variant = "rail",
    previews = {},
    alerts = {},
  }: {
    /** "rail" is the sticky desktop column, "list" the phone index. */
    variant?: "rail" | "list";
    /** slug → the current value, so a section can be read without opening it. */
    previews?: Record<string, string | undefined>;
    /** slug → needs attention (a warning dot next to the label). */
    alerts?: Record<string, boolean>;
  } = $props();

  const groups = $derived(
    SETTINGS_GROUPS.map((group) => ({
      ...group,
      sections: group.sections.filter(
        (section) => !section.social || appConfig.socialEnabled,
      ),
    })).filter((group) => group.sections.length > 0),
  );
  const reduced = prefersReducedMotion();
  const sections = $derived(groups.flatMap((group) => group.sections));

  function shortcutFor(slug: string): string | null {
    const index = sections.findIndex((section) => section.slug === slug);
    return index === -1 ? null : settingsShortcutLabel(index + 1);
  }

  function isActive(slug: string): boolean {
    return page.url.pathname === sectionHref(slug);
  }

  let navEl = $state<HTMLElement | null>(null);
  let indicatorTop = $state(persistedIndicator?.top ?? 0);
  let indicatorHeight = $state(persistedIndicator?.height ?? 0);
  let indicatorVisible = $state(persistedIndicator !== null);
  let indicatorReady = $state(persistedIndicator !== null);

  async function positionIndicator() {
    // Route state changes before the new link has been painted. Measuring in
    // the following render keeps the last position long enough for `top` to
    // interpolate to the new one instead of jumping from the rail's origin.
    await tick();
    // `app/+layout` keys its page content by pathname. Moving between two
    // settings therefore remounts this rail; keep the last coordinates in
    // module state for one frame so the newly mounted indicator can travel
    // from the old link to the new one.
    if (indicatorReady)
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    const active = navEl?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!active) {
      indicatorVisible = false;
      return;
    }
    indicatorTop = active.offsetTop;
    indicatorHeight = active.offsetHeight;
    persistedIndicator = { top: indicatorTop, height: indicatorHeight };
    indicatorVisible = true;
    if (!indicatorReady) {
      // Do not animate the first measurement from `top: 0`; motion is only
      // meaningful after the user changes page.
      requestAnimationFrame(() => (indicatorReady = true));
    }
  }

  // Re-measure when the route changes, and when the group list itself does
  // (social off drops a whole group, moving everything below it).
  $effect(() => {
    void page.url.pathname;
    void groups;
    void positionIndicator();
  });
</script>

{#if variant === "rail"}
  <nav
    bind:this={navEl}
    aria-label={m.common_settings()}
    class="relative flex flex-col gap-4">
    <!-- One indicator for the whole rail: a tinted pill with a straight
         accent bar down its left edge, sliding between entries. -->
    <div
      class="pointer-events-none absolute inset-x-0 {indicatorVisible
        ? 'opacity-100'
        : 'opacity-0'}"
      style="top: {indicatorTop}px; height: {indicatorHeight}px; transition: {indicatorReady &&
      !reduced
        ? 'top 300ms cubic-bezier(0.22, 1, 0.36, 1), height 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease-out'
        : 'none'}"
      aria-hidden="true">
      <div class="bg-accent/10 h-full rounded-lg"></div>
      <div class="bg-accent absolute inset-y-0 left-0 w-0.5"></div>
    </div>

    {#each groups as group (group.id)}
      <div>
        <p
          class="timecode mb-1 px-3 text-[0.65rem] tracking-[0.14em] uppercase">
          {group.label}
        </p>
        <ul>
          {#each group.sections as section (section.slug)}
            {@const active = isActive(section.slug)}
            {@const shortcut = shortcutFor(section.slug)}
            <li>
              <a
                href={sectionHref(section.slug)}
                aria-current={active ? "page" : undefined}
                onclick={() => settingsSearch.clear()}
                class="relative flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-3 text-sm transition-colors {active
                  ? 'text-fg font-semibold'
                  : section.danger
                    ? 'text-dim hover:text-danger hover:bg-surface-2'
                    : 'text-dim hover:text-fg hover:bg-surface-2'}">
                <span class="min-w-0 flex-1 truncate">{section.label}</span>
                {#if shortcut}
                  <kbd
                    class="border-border text-dim shrink-0 rounded border px-1 py-0.5 font-mono text-[0.65rem] leading-none whitespace-nowrap">
                    {shortcut}
                  </kbd>
                {/if}
                {#if alerts[section.slug]}
                  <span
                    class="bg-warning h-1.5 w-1.5 shrink-0 rounded-full"
                    aria-hidden="true"></span>
                {/if}
                {#if section.newBadgeKey && isFeatureNew(section.newBadgeKey)}
                  <span
                    class="bg-accent h-1.5 w-1.5 shrink-0 rounded-full"
                    aria-hidden="true"></span>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>
{:else}
  <nav aria-label={m.common_settings()} class="flex flex-col gap-5">
    {#each groups as group (group.id)}
      <div>
        <p
          class="timecode mb-1.5 px-1 text-[0.65rem] tracking-[0.14em] uppercase">
          {group.label}
        </p>
        <ul class="card divide-border divide-y">
          {#each group.sections as section (section.slug)}
            {@const shortcut = shortcutFor(section.slug)}
            <li>
              <a
                href={sectionHref(section.slug)}
                onclick={() => settingsSearch.clear()}
                class="hover:bg-surface-2 flex items-center gap-3 px-3.5 py-3 transition-colors">
                <Icon
                  name={section.icon}
                  class="h-5 w-5 shrink-0 {section.danger
                    ? 'text-danger'
                    : 'text-accent'}" />
                <span class="min-w-0 flex-1">
                  <span
                    class="flex items-center gap-2 font-semibold {section.danger
                      ? 'text-danger'
                      : ''}">
                    {section.label}
                    {#if section.newBadgeKey && isFeatureNew(section.newBadgeKey)}
                      <NewBadge />
                    {/if}
                  </span>
                  {#if previews[section.slug]}
                    <span class="text-dim block truncate text-sm">
                      {previews[section.slug]}
                    </span>
                  {/if}
                </span>
                {#if shortcut}
                  <kbd
                    class="border-border text-dim hidden shrink-0 rounded border px-1 py-0.5 font-mono text-[0.65rem] leading-none whitespace-nowrap md:block">
                    {shortcut}
                  </kbd>
                {/if}
                {#if alerts[section.slug]}
                  <span
                    class="bg-warning h-2 w-2 shrink-0 rounded-full"
                    aria-hidden="true"></span>
                {/if}
                <Icon name="chevron-right" class="text-dim h-5 w-5 shrink-0" />
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>
{/if}
