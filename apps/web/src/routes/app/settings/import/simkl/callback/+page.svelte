<script lang="ts">
  import { page } from "$app/state";
  import Banner from "$lib/components/Banner.svelte";
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { m } from "$lib/paraglide/messages.js";

  const code = page.url.searchParams.get("code");
  const oauthError = page.url.searchParams.get("error");
</script>

{#if code}
  <ImportWizard source="simkl" autoInput={code}>
    {#snippet intro()}
      {m.settings_import_simkl_connected()}
    {/snippet}
  </ImportWizard>
{:else}
  <div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
    <PageHeader
      title={m.settings_import_simkl_title()}
      back="/app/settings/import" />

    <Banner variant="error">
      {oauthError === "access_denied"
        ? m.settings_import_simkl_cancelled()
        : m.settings_import_simkl_missing_code()}
    </Banner>
    <a href="/app/settings/import/simkl" class="btn btn-primary mt-4">
      {m.common_retry()}
    </a>
  </div>
{/if}
