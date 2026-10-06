<script lang="ts">
  import { page } from "$app/state";
  import { updateMe } from "#lib/api/auth.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import Switch from "#lib/components/Switch.svelte";
  import { feedbackBoardUrl } from "#lib/corner-launchers.svelte.js";
  import {
    CHANGELOG_URL,
    DOCS_URL,
    FEEDBACK_BUG_REPORTS_URL,
    FEEDBACK_FEATURE_REQUESTS_URL,
    ROADMAP_URL,
    STATUS_URL,
  } from "#lib/constants/external-links.js";
  import { m } from "#lib/paraglide/messages.js";
  import SettingRow from "../components/SettingRow.svelte";
  import SettingsSection from "../components/SettingsSection.svelte";
  import { flashAnchor } from "../flash-anchor";

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
    {
      anchor: "help-docs",
      href: `${DOCS_URL}/guide/`,
      icon: "book-open" as const,
      label: m.settings_help_docs(),
    },
    {
      anchor: "help-faq",
      href: `${DOCS_URL}/guide/faq/`,
      icon: "question" as const,
      label: m.settings_help_faq(),
    },
    {
      anchor: "help-status",
      href: STATUS_URL,
      icon: "activity" as const,
      label: m.settings_help_status(),
    },
  ];

  function openChat() {
    window.Quackback?.("open");
  }

  const feedbackWidgetMut = createApiMutation(() => ({
    mutate: (feedbackWidget: boolean) => updateMe({ feedbackWidget }),
    errorToast: true,
  }));
</script>

<SettingsSection slug="help">
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

    {#if feedbackBoardUrl && auth.user}
      {@const user = auth.user}
      <div class="card p-4 md:p-5">
        <SettingRow
          anchor="feedback-widget"
          label={m.settings_feedback_widget()}
          description={m.settings_feedback_widget_desc()}
          mutation={feedbackWidgetMut}>
          {#snippet control()}
            <Switch
              label={m.settings_feedback_widget()}
              checked={user.feedbackWidget}
              onChange={(value) => feedbackWidgetMut.mutate(value)} />
          {/snippet}
        </SettingRow>
      </div>
    {/if}

    <!-- The chat is the feedback board's: nothing to open without one. -->
    {#if feedbackBoardUrl}
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
    {/if}

    <a
      id="help-shortcuts"
      use:flashAnchor={{ anchor: "help-shortcuts", hash: page.url.hash }}
      href="/app/settings/help/shortcuts"
      class="card hover:border-accent hover:bg-surface-2 hidden items-center gap-3 p-4 transition-[border-color,background-color] md:flex">
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
</SettingsSection>
