<script lang="ts">
  import HomeLayoutEditor from "#lib/home/HomeLayoutEditor.svelte";
  import PhoneHomeEditor from "#lib/home/PhoneHomeEditor.svelte";
  import { layout } from "#lib/shell/layout.svelte.js";
  import PageHeader from "#lib/ui/PageHeader.svelte";
  import { m } from "#lib/paraglide/messages.js";
</script>

<!-- Same width and gutters as the home page, so every widget is laid out
     exactly as it will be there. A phone edits its own home, as a list. -->
<div class="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="layout"
    title={m.home_editor_title()}
    back="/app/settings/appearance#home-layout"
    backInHistory
    class="mb-4" />
  {#if layout.compact}<PhoneHomeEditor />{:else}<HomeLayoutEditor />{/if}
</div>
