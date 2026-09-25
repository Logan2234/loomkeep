<script lang="ts">
  import HomeLayoutEditor from "$lib/components/home/HomeLayoutEditor.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
</script>

<!-- Same width and gutters as the home page, so every widget is laid out
     exactly as it will be there. -->
<div class="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="layout"
    title={m.home_editor_title()}
    subtitle={m.home_editor_subtitle()}
    back="/app/settings/appearance#home-layout"
    isNew={isFeatureNew("home-layout")}
    class="mb-4" />
  <HomeLayoutEditor />
</div>
