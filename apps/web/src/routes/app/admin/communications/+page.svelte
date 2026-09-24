<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { adminFilterHref } from "$lib/admin-filter-url";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import TabPanels from "$lib/components/TabPanels.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import { m } from "$lib/paraglide/messages";
  import EmailTab from "./components/EmailTab.svelte";
  import PushTab from "./components/PushTab.svelte";

  type Tab = "email" | "push";
  const tabs: { value: Tab; label: string }[] = [
    { value: "email", label: m.common_email() },
    { value: "push", label: m.admin_communications_push() },
  ];
  const tab = $derived<Tab>(
    page.url.searchParams.get("tab") === "push" ? "push" : "email",
  );

  function changeTab(next: Tab) {
    void goto(
      adminFilterHref(page.url, { tab: next === "email" ? null : next }),
      {
        noScroll: true,
        keepFocus: true,
      },
    );
  }
</script>

<div>
  <PageHeader
    icon="mail"
    title={m.settings_section_communications()}
    subtitle={m.admin_communications_subtitle()}
    back="/app/admin" />

  <Tabs
    class="mb-6"
    label={m.settings_section_communications()}
    idPrefix="communications"
    {tabs}
    current={tab}
    onSelect={changeTab} />

  <TabPanels current={tab} idPrefix="communications">
    {#if tab === "email"}
      <EmailTab />
    {:else}
      <PushTab />
    {/if}
  </TabPanels>
</div>
