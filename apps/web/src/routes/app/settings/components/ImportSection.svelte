<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<section class="card mb-5 p-5 md:p-6">
  <h2 class="font-display mb-1 text-lg font-bold">
    {m.settings_import_title()}
  </h2>
  <p class="text-dim mb-4 text-sm">
    {m.settings_import_body()}
  </p>
  <a
    href="/app/settings/import"
    class="border-border bg-bg hover:border-accent hover:bg-surface-2 flex items-center gap-3 rounded-lg border p-4 transition-colors">
    <Icon name="download" class="text-accent h-6 w-6" />
    <span class="flex-1">
      <span class="block font-semibold"
        >{m.settings_import_sources_available()}</span>
      <span class="text-dim text-sm">
        {m.settings_import_sources_hint()}
      </span>
    </span>
    <Icon name="chevron-right" class="text-dim h-5 w-5" />
  </a>
</section>
