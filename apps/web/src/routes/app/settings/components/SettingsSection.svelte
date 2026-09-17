<script lang="ts">
  // One section's page shell: the way back on a phone, then the title and
  // the one line of what the section is for. Both come from the nav model,
  // so a section's name is written once and the rail, the index, the search
  // and this header all agree.
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import { findSection } from "../nav";

  let { slug, children }: { slug: string; children: Snippet } = $props();

  const section = $derived(findSection(slug));
</script>

<!-- Phone only: from lg up the rail is the way back, and a chevron would
     point at an index that immediately forwards here. -->
<a
  href="/app/settings"
  class="text-dim hover:text-fg mb-4 inline-flex items-center gap-1 text-sm font-semibold transition-colors lg:hidden">
  <Icon name="chevron-left" class="h-4 w-4" />
  {m.common_settings()}
</a>

{#if section}
  <PageHeader
    title={section.label}
    subtitle={section.description}
    icon={section.icon}
    isNew={section.newBadgeKey ? isFeatureNew(section.newBadgeKey) : false}
    class="mb-6" />
{/if}

{@render children()}
