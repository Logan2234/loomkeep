<script lang="ts">
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import {
    CHANGELOG_URL,
    FEEDBACK_BUG_REPORTS_URL,
    FEEDBACK_FEATURE_REQUESTS_URL,
    ROADMAP_URL,
  } from "$lib/constants/external-links";
  import { m } from "$lib/paraglide/messages.js";
  import { flashAnchor } from "../flash-anchor";

  // `anchor` matches the entry ids in nav.ts, so a search result for
  // "roadmap" lands on that tile rather than at the top of the section.
  const LINKS = [
    {
      anchor: "help-idea",
      href: FEEDBACK_FEATURE_REQUESTS_URL,
      icon: "sparkles" as const,
      label: m.common_suggest_idea(),
    },
    {
      anchor: "help-bug",
      href: FEEDBACK_BUG_REPORTS_URL,
      icon: "flag" as const,
      label: m.common_report_bug(),
    },
    {
      anchor: "help-roadmap",
      href: ROADMAP_URL,
      icon: "gauge" as const,
      label: m.settings_help_roadmap(),
    },
    {
      anchor: "help-changelog",
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

<div class="space-y-3">
  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
    {#each LINKS as link (link.href)}
      <a
        id={link.anchor}
        use:flashAnchor={{ anchor: link.anchor, hash: page.url.hash }}
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        class="card hover:border-accent hover:bg-surface-2 flex items-center gap-2.5 p-4 text-sm font-semibold transition-[border-color,background-color]">
        <Icon name={link.icon} class="text-accent h-4 w-4 shrink-0" />
        {link.label}
      </a>
    {/each}
  </div>

  <section
    id="help-chat"
    use:flashAnchor={{ anchor: "help-chat", hash: page.url.hash }}
    class="card p-5 md:p-6">
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
  </section>

  <a
    id="help-shortcuts"
    use:flashAnchor={{ anchor: "help-shortcuts", hash: page.url.hash }}
    href="/app/settings/help/shortcuts"
    class="card hover:border-accent hover:bg-surface-2 flex items-center gap-3 p-4 transition-[border-color,background-color]">
    <Icon name="keyboard" class="text-accent h-4 w-4 shrink-0" />
    <span class="min-w-0 flex-1">
      <span class="block text-sm font-semibold">
        {m.settings_shortcuts_title()}
      </span>
      <span class="text-dim block text-xs">
        {m.settings_shortcuts_link_hint()}
      </span>
    </span>
    <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
  </a>
</div>
