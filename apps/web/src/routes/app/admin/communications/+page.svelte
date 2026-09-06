<script lang="ts">
  // Merges the former /admin/emails and /admin/push pages: same admin gesture
  // on two channels (preview/test-send a template vs. test/broadcast a push),
  // now two tabs of one page instead of two nav entries.
  import { page } from "$app/state";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { m } from "$lib/paraglide/messages";
  import EmailTab from "./components/EmailTab.svelte";
  import PushTab from "./components/PushTab.svelte";

  type Tab = "email" | "push";
  let tab = $state<Tab>(
    page.url.searchParams.get("tab") === "push" ? "push" : "email",
  );
</script>

<div class="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="mail"
    title={m.settings_section_communications()}
    subtitle={m.admin_communications_subtitle()} />

  <div class="mb-6 flex gap-2">
    <button
      type="button"
      class="chip"
      class:chip-on={tab === "email"}
      onclick={() => (tab = "email")}>
      {m.common_email()}
    </button>
    <button
      type="button"
      class="chip"
      class:chip-on={tab === "push"}
      onclick={() => (tab = "push")}>
      {m.admin_communications_push()}
    </button>
  </div>

  {#if tab === "email"}
    <EmailTab />
  {:else}
    <PushTab />
  {/if}
</div>
