<script lang="ts">
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import type { Snippet } from "svelte";
  import { findSection } from "../nav";

  let { slug, children }: { slug: string; children: Snippet } = $props();

  const section = $derived(findSection(slug));
</script>

{#if section}
  <PageHeader
    title={section.label}
    subtitle={section.description}
    icon={section.icon}
    isNew={section.newBadgeKey ? isFeatureNew(section.newBadgeKey) : false}
    back="/app/settings"
    class="mb-6" />
{/if}

{@render children()}
