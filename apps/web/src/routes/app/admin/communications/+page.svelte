<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { adminFilterHref } from "$lib/admin-filter-url";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages";
  import EmailTab from "./components/EmailTab.svelte";
  import PushTab from "./components/PushTab.svelte";
  import { fade, fly } from "svelte/transition";

  type Tab = "email" | "push";
  const reduced = prefersReducedMotion();
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
    tabs={[
      { value: "email" as const, label: m.common_email() },
      { value: "push" as const, label: m.admin_communications_push() },
    ]}
    current={tab}
    onSelect={changeTab} />

  {#key tab}
    <div
      id="communications-{tab}-panel"
      role="tabpanel"
      aria-labelledby="communications-{tab}-tab"
      in:fly|global={{ y: reduced ? 0 : 8, duration: reduced ? 0 : 180 }}
      out:fade|global={{ duration: reduced ? 0 : 120 }}>
      {#if tab === "email"}
        <EmailTab />
      {:else}
        <PushTab />
      {/if}
    </div>
  {/key}
</div>
