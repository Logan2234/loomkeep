<script lang="ts">
  // Search results take over the content column. A row match links to its
  // anchor inside the owning section, so clicking it lands on the control
  // rather than on the section's title.
  import Icon from "$lib/components/Icon.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { SETTINGS_SECTIONS } from "../nav";
  import { hitHref, searchSettings } from "../search";
  import { settingsSearch } from "../search-state.svelte";

  const visibleSections = $derived(
    SETTINGS_SECTIONS.filter(
      (section) => !section.social || appConfig.socialEnabled,
    ),
  );
  const results = $derived(
    searchSettings(settingsSearch.query, visibleSections),
  );
  const query = $derived(settingsSearch.query.trim());
</script>

<!-- The section underneath is still mounted-in-name-only while a query is
     active, so without this the tab keeps its title. -->
<svelte:head>
  <title>{m.common_results()} · {m.common_loomkeep()}</title>
</svelte:head>

<h1 class="font-display mb-1 text-2xl font-bold tracking-tight">
  {m.common_results()}
</h1>

{#if results.length === 0}
  <p class="text-dim mt-4 text-sm">{m.settings_search_empty({ query })}</p>
{:else}
  <p class="text-dim mb-6 text-sm">
    {results.length > 1
      ? m.settings_search_count_many({ count: results.length, query })
      : m.settings_search_count_one({ count: results.length, query })}
  </p>
  <ul class="card divide-border divide-y">
    {#each results as hit (`${hit.section.slug}:${hit.entryId ?? ""}`)}
      <li>
        <a
          href={hitHref(hit)}
          onclick={() => settingsSearch.clear()}
          class="hover:bg-surface-2 flex items-center gap-3.5 px-4 py-3.5 transition-colors">
          <Icon
            name={hit.section.icon}
            class="h-5 w-5 shrink-0 {hit.section.danger
              ? 'text-danger'
              : 'text-accent'}" />
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">
              {hit.entryLabel ?? hit.section.label}
            </span>
            <span class="timecode block truncate text-[0.7rem]">
              {hit.entryLabel ? hit.section.label : hit.section.description}
            </span>
          </span>
          <Icon name="chevron-right" class="text-dim h-5 w-5 shrink-0" />
        </a>
      </li>
    {/each}
  </ul>
{/if}
