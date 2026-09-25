<script lang="ts">
  import { browser } from "$app/environment";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import type { Snippet } from "svelte";
  import { findSection } from "../nav";

  let { slug, children }: { slug: string; children: Snippet } = $props();

  const section = $derived(findSection(slug));
  let isDesktop = $state(false);

  $effect(() => {
    if (!browser) return;

    const media = window.matchMedia("(min-width: 768px)");
    const update = () => (isDesktop = media.matches);

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  });
</script>

{#if section}
  <PageHeader
    title={section.label}
    subtitle={section.description}
    icon={section.icon}
    isNew={section.newBadgeKey ? isFeatureNew(section.newBadgeKey) : false}
    back={isDesktop ? "/app/profile" : "/app/settings"}
    class="mb-6" />
{/if}

{@render children()}
