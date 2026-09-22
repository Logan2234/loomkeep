<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { adminFilterHref } from "$lib/admin-filter-url";
  import PageHeader from "$lib/components/PageHeader.svelte";
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

  <div
    class="mb-6 flex gap-2"
    role="tablist"
    aria-label={m.settings_section_communications()}>
    <button
      id="communications-email-tab"
      type="button"
      role="tab"
      aria-selected={tab === "email"}
      aria-controls="communications-email-panel"
      class="chip"
      class:chip-on={tab === "email"}
      onclick={() => changeTab("email")}>
      {m.common_email()}
    </button>
    <button
      id="communications-push-tab"
      type="button"
      role="tab"
      aria-selected={tab === "push"}
      aria-controls="communications-push-panel"
      class="chip"
      class:chip-on={tab === "push"}
      onclick={() => changeTab("push")}>
      {m.admin_communications_push()}
    </button>
  </div>

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
