<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import {
    CHANGELOG_URL,
    FEEDBACK_BUG_REPORTS_URL,
    FEEDBACK_FEATURE_REQUESTS_URL,
    ROADMAP_URL,
  } from "$lib/constants/external-links";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";

  const LINKS = [
    {
      href: FEEDBACK_FEATURE_REQUESTS_URL,
      icon: "sparkles" as const,
      label: m.settings_help_feature_request(),
    },
    {
      href: FEEDBACK_BUG_REPORTS_URL,
      icon: "flag" as const,
      label: m.settings_help_bug_report(),
    },
    {
      href: ROADMAP_URL,
      icon: "gauge" as const,
      label: m.settings_help_roadmap(),
    },
    {
      href: CHANGELOG_URL,
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
    {m.common_help()} & {m.common_feedback()}
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
