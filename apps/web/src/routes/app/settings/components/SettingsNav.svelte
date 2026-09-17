<script lang="ts">
  // The five groups, rendered twice: as the desktop rail and as the phone
  // index. The active highlight is one element that flies between entries —
  // a crossfade pairs the outgoing and incoming halves, so changing section
  // moves the highlight instead of blinking it to a new place.
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { cubicOut } from "svelte/easing";
  import { crossfade } from "svelte/transition";
  import { SETTINGS_GROUPS, sectionHref } from "../nav";

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

  const reduced = prefersReducedMotion();

  const [send, receive] = crossfade({
    duration: reduced ? 0 : 220,
    easing: cubicOut,
  });

  const groups = $derived(
    SETTINGS_GROUPS.map((group) => ({
      ...group,
      sections: group.sections.filter(
        (section) => !section.social || appConfig.socialEnabled,
      ),
    })).filter((group) => group.sections.length > 0),
  );

  function isActive(slug: string): boolean {
    return page.url.pathname === sectionHref(slug);
  }
</script>

{#if variant === "rail"}
  <nav aria-label={m.common_settings()} class="flex flex-col gap-4">
    {#each groups as group (group.id)}
      <div>
        <p
          class="timecode mb-1 px-3 text-[0.65rem] tracking-[0.14em] uppercase">
          {group.label}
        </p>
        <ul>
          {#each group.sections as section (section.slug)}
            {@const active = isActive(section.slug)}
            <li>
              <a
                href={sectionHref(section.slug)}
                aria-current={active ? "page" : undefined}
                class="relative flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-3 text-sm transition-colors {active
                  ? 'text-fg font-semibold'
                  : section.danger
                    ? 'text-dim hover:text-danger hover:bg-surface-2'
                    : 'text-dim hover:text-fg hover:bg-surface-2'}">
                {#if active}
                  <span
                    in:receive={{ key: "settings-rail-highlight" }}
                    out:send={{ key: "settings-rail-highlight" }}
                    class="bg-accent/10 border-l-accent absolute inset-0 rounded-lg border-l-2"
                  ></span>
                {/if}
                <span class="relative min-w-0 flex-1 truncate">
                  {section.label}
                </span>
                {#if alerts[section.slug]}
                  <span
                    class="bg-warning relative h-1.5 w-1.5 shrink-0 rounded-full"
                    aria-hidden="true"></span>
                {/if}
                {#if section.newBadgeKey && isFeatureNew(section.newBadgeKey)}
                  <span
                    class="bg-accent relative h-1.5 w-1.5 shrink-0 rounded-full"
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
                <Icon name="chevron-right" class="text-dim h-5 w-5 shrink-0" />
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>
{/if}
