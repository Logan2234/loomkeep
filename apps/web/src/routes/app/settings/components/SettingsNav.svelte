<script lang="ts">
  // Search + the five groups, in one component used twice: as the desktop
  // rail (in the settings layout) and as the mobile index list. Both need the
  // same model, and the search is the point — the old page could only jump to
  // a section you had already guessed the name of.
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
  import { SETTINGS_GROUPS, sectionHref } from "../nav";
  import { searchSettings } from "../search";

  let {
    variant = "rail",
    previews = {},
    alerts = {},
  }: {
    /** "rail" is the sticky desktop column, "list" the mobile index. */
    variant?: "rail" | "list";
    /** slug → the current value, so a section can be read without opening it. */
    previews?: Record<string, string | undefined>;
    /** slug → needs attention (a warning dot next to the label). */
    alerts?: Record<string, boolean>;
  } = $props();

  let query = $state("");
  let inputEl = $state<HTMLInputElement | null>(null);
  let resultsEl = $state<HTMLElement | null>(null);

  const groups = $derived(
    SETTINGS_GROUPS.map((group) => ({
      ...group,
      sections: group.sections.filter(
        (section) => !section.social || appConfig.socialEnabled,
      ),
    })).filter((group) => group.sections.length > 0),
  );

  const visibleSections = $derived(groups.flatMap((group) => group.sections));
  const results = $derived(searchSettings(query, visibleSections));
  const searching = $derived(query.trim().length > 0);

  // Rendered as an expression rather than a message: it names keys, and the
  // key it names depends on the machine, not the language.
  const shortcutLabel = $derived.by(() => {
    if (typeof navigator === "undefined") return "Ctrl K";
    const apple = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    return apple ? "⌘ K" : "Ctrl K";
  });

  function isActive(slug: string): boolean {
    return page.url.pathname === sectionHref(slug);
  }

  // Both instances are mounted at once (one is display:none per viewport), so
  // the shortcut goes to whichever is actually on screen.
  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key !== "k" || !(event.metaKey || event.ctrlKey)) return;
    if (!inputEl?.offsetParent) return;
    event.preventDefault();
    inputEl.focus();
    inputEl.select();
  }

  function onSearchKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && query) {
      event.preventDefault();
      query = "";
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      resultsEl?.querySelector("a")?.focus();
      return;
    }
    if (event.key === "Enter" && results.length > 0) {
      event.preventDefault();
      void goto(sectionHref(results[0].section.slug));
      query = "";
      inputEl?.blur();
    }
  }

  function onResultNavigate() {
    query = "";
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="flex flex-col gap-4">
  <div class="relative">
    <label class="sr-only" for="settings-search-{variant}">
      {m.settings_search_placeholder()}
    </label>
    <Icon
      name="search"
      class="text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
    <input
      bind:this={inputEl}
      bind:value={query}
      id="settings-search-{variant}"
      type="search"
      autocomplete="off"
      class="input py-2 pr-16 pl-9 text-sm"
      placeholder={m.settings_search_placeholder()}
      onkeydown={onSearchKeydown} />
    <kbd
      class="border-border text-dim pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-[0.65rem] whitespace-nowrap">
      {shortcutLabel}
    </kbd>
  </div>

  {#if searching}
    <div bind:this={resultsEl}>
      <p class="timecode mb-2 block text-[0.65rem] tracking-[0.14em] uppercase">
        {m.settings_search_results()}
      </p>
      {#if results.length === 0}
        <p class="text-dim text-sm">
          {m.settings_search_empty({ query: query.trim() })}
        </p>
      {:else}
        <ul class="card divide-border divide-y">
          {#each results as hit (`${hit.section.slug}:${hit.entryLabel ?? ""}`)}
            <li>
              <a
                href={sectionHref(hit.section.slug)}
                onclick={onResultNavigate}
                class="hover:bg-surface-2 flex items-center gap-3 px-3.5 py-2.5 transition-colors">
                <Icon
                  name={hit.section.icon}
                  class="text-accent h-4 w-4 shrink-0" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold">
                    {hit.entryLabel ?? hit.section.label}
                  </span>
                  {#if hit.entryLabel}
                    <span class="timecode block truncate text-[0.65rem]">
                      {hit.section.label}
                    </span>
                  {/if}
                </span>
                <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else if variant === "rail"}
    <nav aria-label={m.common_settings()} class="flex flex-col gap-4">
      {#each groups as group (group.id)}
        <div>
          <p
            class="timecode mb-1 px-2 text-[0.65rem] tracking-[0.14em] uppercase">
            {group.label}
          </p>
          <ul>
            {#each group.sections as section (section.slug)}
              {@const active = isActive(section.slug)}
              <li>
                <a
                  href={sectionHref(section.slug)}
                  aria-current={active ? "page" : undefined}
                  class="flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-1.5 text-sm transition-colors {active
                    ? 'bg-accent/10 text-fg font-semibold'
                    : section.danger
                      ? 'text-dim hover:text-danger hover:bg-surface-2'
                      : 'text-dim hover:text-fg hover:bg-surface-2'}">
                  <span
                    class="h-3.5 w-0.5 shrink-0 rounded-full {active
                      ? 'bg-accent'
                      : 'bg-transparent'}"></span>
                  <span class="min-w-0 flex-1 truncate">{section.label}</span>
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
              <li>
                <a
                  href={sectionHref(section.slug)}
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
                  {#if alerts[section.slug]}
                    <span
                      class="bg-warning h-2 w-2 shrink-0 rounded-full"
                      aria-hidden="true"></span>
                  {/if}
                  <Icon
                    name="chevron-right"
                    class="text-dim h-5 w-5 shrink-0" />
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>
  {/if}
</div>
