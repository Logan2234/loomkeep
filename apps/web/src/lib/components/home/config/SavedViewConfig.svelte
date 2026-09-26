<script lang="ts">
  // The saved view a widget shows. A pick among however many views the user
  // saved, so a combobox rather than the segmented control of fixed choices.
  import { getSavedViews } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { isDomainEnabled, orderedDomains } from "$lib/domains";
  import { m } from "$lib/paraglide/messages.js";

  let { viewId = $bindable() }: { viewId: string | undefined } = $props();

  const viewsQuery = createApiQuery(() => ({
    key: keys.savedViews.all(),
    fetch: getSavedViews,
  }));
  const choices = $derived(
    orderedDomains(auth.user?.domainOrder)
      .filter(isDomainEnabled)
      .flatMap((domain) =>
        (viewsQuery.data ?? [])
          .filter((view) => view.domain === domain)
          .map((view) => ({
            value: view.id,
            label: `${DOMAINS[domain].label} · ${view.name}`,
          })),
      ),
  );
</script>

{#if viewsQuery.loading}
  <div class="skeleton h-10 w-full rounded-lg"></div>
{:else if choices.length === 0}
  <p class="text-dim text-sm">{m.home_saved_view_config_none()}</p>
{:else}
  <Combobox
    label={m.home_saved_view_config_pick()}
    options={choices}
    values={viewId ? [viewId] : []}
    onChange={(values) => (viewId = values[0] ?? viewId)} />
{/if}
