<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";

  const LINKS = [
    {
      href: "https://feedback.loomkeep.app/?board=feature-requests",
      icon: "sparkles" as const,
      label: m.settings_help_feature_request(),
    },
    {
      href: "https://feedback.loomkeep.app/?board=bug-reports",
      icon: "flag" as const,
      label: m.settings_help_bug_report(),
    },
    {
      href: "https://feedback.loomkeep.app/roadmap",
      icon: "gauge" as const,
      label: m.settings_help_roadmap(),
    },
    {
      href: "https://feedback.loomkeep.app/changelog",
      icon: "list" as const,
      label: m.settings_help_changelog(),
    },
  ];

  // The floating launcher isn't shown everywhere (hidden on mobile — see
  // WidgetIdentify.svelte), so this button is the one always-available way
  // to open the chat regardless of screen size or launcher state.
  function openChat() {
    window.Quackback?.("open");
  }
</script>

<section class="card mb-5 p-5 md:p-6">
  <h2 class="font-display mb-1 flex items-center gap-2 text-lg font-bold">
    {m.settings_help_title()}
    {#if isFeatureNew("help-feedback")}
      <NewBadge />
    {/if}
  </h2>
  <p class="text-dim mb-4 text-sm">
    {m.settings_help_body()}
  </p>

  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
    {#each LINKS as link (link.href)}
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        class="card hover:border-accent flex items-center gap-2.5 p-3 text-sm font-semibold transition-[border-color]">
        <Icon name={link.icon} class="text-accent h-4 w-4 shrink-0" />
        {link.label}
      </a>
    {/each}
  </div>

  <div class="border-border mt-5 border-t pt-5">
    <p class="flex items-center gap-2 font-semibold">
      <Icon name="message" class="text-accent h-4 w-4" />
      {m.settings_help_chat_title()}
    </p>
    <p class="text-dim mb-3 text-sm">
      {m.settings_help_chat_body()}
    </p>
    <button class="btn btn-ghost" onclick={openChat}>
      {m.settings_help_chat_title()}
    </button>
  </div>
</section>
