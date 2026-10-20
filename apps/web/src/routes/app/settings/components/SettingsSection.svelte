<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";

  import { TABLET_QUERY } from "#lib/constants/media-queries.js";

  import PageHeader from "#lib/components/PageHeader.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import type { Snippet } from "svelte";
  import { findSection, sectionHref } from "../nav";

  let { slug, children }: { slug: string; children: Snippet } = $props();

  const section = $derived(findSection(slug));
  const desktop = new MediaQuery(TABLET_QUERY);
</script>

{#if section}
  <PageHeader
    title={section.label}
    subtitle={section.description}
    icon={section.icon}
    isNew={section.newBadgeKey ? isFeatureNew(section.newBadgeKey) : false}
    back={section.parent
      ? sectionHref(section.parent)
      : desktop.current
        ? "/app/profile"
        : "/app/settings"}
    class="mb-6" />
{/if}

{@render children()}
