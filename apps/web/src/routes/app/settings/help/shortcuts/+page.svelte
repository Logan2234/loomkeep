<script lang="ts">
  import { appConfig } from "#lib/config.svelte.js";
  import type { IconName } from "#lib/types/icon-name.js";
  import Icon from "#lib/components/Icon.svelte";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { settingsShortcutLabel } from "../../keyboard-navigation";
  import { SETTINGS_SECTIONS, type SettingsSectionDef } from "../../nav";

  // Named after the key it actually names on this machine — see
  // SettingsSearchField, which computes the same label for the same reason.
  const isMac = $derived(
    typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform),
  );
  const mod = $derived(isMac ? "⌘" : "Ctrl");

  // Messages: what the composer and the conversation list answer to.
  const CHAT_SHORTCUTS = $derived<
    { icon: IconName; label: string; keys: string[] }[]
  >([
    { icon: "send", label: m.settings_shortcuts_chat_send(), keys: ["↵"] },
    {
      icon: "rows",
      label: m.settings_shortcuts_chat_newline(),
      keys: ["⇧ ↵"],
    },
    {
      icon: "edit",
      label: m.settings_shortcuts_chat_bold(),
      keys: [`${mod} B`],
    },
    {
      icon: "edit",
      label: m.settings_shortcuts_chat_italic(),
      keys: [`${mod} I`],
    },
    {
      icon: "edit",
      label: m.settings_shortcuts_chat_strike(),
      keys: [`${mod} ⇧ X`],
    },
    {
      icon: "edit",
      label: m.settings_shortcuts_chat_code(),
      keys: [`${mod} E`],
    },
    {
      icon: "eye-off",
      label: m.settings_shortcuts_chat_spoiler(),
      keys: [`${mod} ⇧ S`],
    },
    {
      icon: "book-open",
      label: m.settings_shortcuts_chat_commands(),
      keys: ["/"],
    },
    {
      icon: "search",
      label: m.settings_shortcuts_chat_mention(),
      keys: ["#"],
    },
    {
      icon: "edit",
      label: m.settings_shortcuts_chat_edit_last(),
      keys: ["↑"],
    },
    {
      icon: "search",
      label: m.chat_search_messages(),
      keys: [`${mod} F`],
    },
    {
      icon: "message",
      label: m.settings_shortcuts_chat_switch(),
      keys: [isMac ? "⌥ ↑" : "Alt ↑", isMac ? "⌥ ↓" : "Alt ↓"],
    },
    {
      icon: "x",
      label: m.settings_shortcuts_chat_escape(),
      keys: [m.settings_shortcuts_escape()],
    },
  ]);

  const shortcutLabel = $derived(
    typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform)
      ? "⌘ K"
      : "Ctrl K",
  );

  // Same filter as the settings layout's own Alt+N handler — a hidden
  // section (social off) isn't reachable by its shortcut either, so it has
  // no business appearing here.
  const visibleSections = $derived(
    SETTINGS_SECTIONS.filter(
      (section) => !section.social || appConfig.socialEnabled,
    ),
  );
  const sectionShortcuts = $derived(
    visibleSections
      .map((section, index) => ({
        section,
        shortcut: settingsShortcutLabel(index + 1),
      }))
      .filter(
        (entry): entry is { section: SettingsSectionDef; shortcut: string } =>
          entry.shortcut !== null,
      ),
  );
</script>

<svelte:head>
  <title>{m.settings_shortcuts_title()} · {m.common_loomkeep()}</title>
</svelte:head>

<div class="max-w-3xl">
  <PageHeader
    icon="keyboard"
    title={m.settings_shortcuts_title()}
    subtitle={m.settings_shortcuts_description()}
    back="/app/settings/help"
    class="mb-6" />

  <section class="card divide-border mb-4 divide-y p-5 md:p-6">
    <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
      <span class="flex items-center gap-3">
        <Icon name="search" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold">{m.settings_shortcuts_search()}</span>
      </span>
      <kbd
        class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
        {shortcutLabel}
      </kbd>
    </div>
    <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
      <span class="flex items-center gap-3">
        <Icon name="x" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold">{m.settings_shortcuts_clear_search()}</span>
      </span>
      <kbd
        class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
        {m.settings_shortcuts_escape()}
      </kbd>
    </div>
  </section>

  <p class="text-dim mb-2 text-sm font-semibold">
    {m.common_search()}
  </p>
  <section class="card divide-border mb-4 divide-y p-5 md:p-6">
    <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
      <span class="flex items-center gap-3">
        <Icon name="search" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold">
          {m.settings_shortcuts_search_switch_domain()}
        </span>
      </span>
      <span class="flex items-center gap-1">
        <kbd
          class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          Tab
        </kbd>
        <kbd
          class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          ⇧ Tab
        </kbd>
      </span>
    </div>
    <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
      <span class="flex items-center gap-3">
        <Icon name="x" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold">
          {m.settings_shortcuts_search_leave_field()}
        </span>
      </span>
      <kbd
        class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
        {m.settings_shortcuts_escape()}
      </kbd>
    </div>
  </section>

  <p class="text-dim mb-2 text-sm font-semibold">
    {m.common_libraries()}
  </p>
  <section class="card divide-border mb-4 divide-y p-5 md:p-6">
    <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
      <span class="flex items-center gap-3">
        <Icon name="rows" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold">{m.settings_shortcuts_library_move()}</span>
      </span>
      <span class="flex items-center gap-1">
        <kbd
          class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          J
        </kbd>
        <kbd
          class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          K
        </kbd>
      </span>
    </div>
    <div class="flex items-center justify-between gap-4 py-3">
      <span class="flex items-center gap-3">
        <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold">{m.settings_shortcuts_library_open()}</span>
      </span>
      <span class="flex items-center gap-1">
        <kbd
          class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          ↵
        </kbd>
      </span>
    </div>
    <div class="flex items-center justify-between gap-4 py-3">
      <span class="flex items-center gap-3">
        <Icon name="check" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold"
          >{m.settings_shortcuts_library_select()}</span>
      </span>
      <span class="flex items-center gap-1">
        <kbd
          class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          X
        </kbd>
      </span>
    </div>
    <div class="flex items-center justify-between gap-4 py-3">
      <span class="flex items-center gap-3">
        <Icon name="check" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold"
          >{m.settings_shortcuts_library_range()}</span>
      </span>
      <span class="flex items-center gap-1">
        <kbd
          class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          ⇧ X
        </kbd>
      </span>
    </div>
    <div class="flex items-center justify-between gap-4 py-3">
      <span class="flex items-center gap-3">
        <Icon name="check" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold"
          >{m.settings_shortcuts_library_select_all()}</span>
      </span>
      <span class="flex items-center gap-1">
        <kbd
          class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          ⇧ A
        </kbd>
      </span>
    </div>
    <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
      <span class="flex items-center gap-3">
        <Icon name="x" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold">{m.settings_shortcuts_library_exit()}</span>
      </span>
      <span class="flex items-center gap-1">
        <kbd
          class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          {m.settings_shortcuts_escape()}
        </kbd>
      </span>
    </div>
  </section>

  <p class="text-dim mb-2 text-sm font-semibold">
    {m.settings_shortcuts_viewer_title()}
  </p>
  <section class="card divide-border mb-4 divide-y p-5 md:p-6">
    <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
      <span class="flex items-center gap-3">
        <Icon name="chevron-left" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold">{m.common_image_previous()}</span>
      </span>
      <kbd
        class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
        ←
      </kbd>
    </div>
    <div class="flex items-center justify-between gap-4 py-3">
      <span class="flex items-center gap-3">
        <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold">{m.common_image_next()}</span>
      </span>
      <kbd
        class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
        →
      </kbd>
    </div>
    <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
      <span class="flex items-center gap-3">
        <Icon name="x" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold">{m.settings_shortcuts_viewer_close()}</span>
      </span>
      <kbd
        class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
        {m.settings_shortcuts_escape()}
      </kbd>
    </div>
  </section>

  {#if appConfig.socialEnabled}
    <p class="text-dim mb-2 text-sm font-semibold">
      {m.settings_shortcuts_mentions_title()}
    </p>
    <section class="card divide-border mb-4 divide-y p-5 md:p-6">
      <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
        <span class="font-semibold"
          >{m.settings_shortcuts_mentions_previous()}</span>
        <kbd
          class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          ↑
        </kbd>
      </div>
      <div class="flex items-center justify-between gap-4 py-3">
        <span class="font-semibold"
          >{m.settings_shortcuts_mentions_next()}</span>
        <kbd
          class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          ↓
        </kbd>
      </div>
      <div class="flex items-center justify-between gap-4 py-3">
        <span class="font-semibold"
          >{m.settings_shortcuts_mentions_choose()}</span>
        <span class="flex items-center gap-1">
          <kbd
            class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
            ↵
          </kbd>
          <kbd
            class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
            Tab
          </kbd>
        </span>
      </div>
      <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
        <span class="font-semibold"
          >{m.settings_shortcuts_mentions_close()}</span>
        <kbd
          class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          {m.settings_shortcuts_escape()}
        </kbd>
      </div>
    </section>
  {/if}

  <p class="text-dim mb-2 text-sm font-semibold">
    {m.settings_shortcuts_overlays_title()}
  </p>
  <section class="card mb-4 p-5 md:p-6">
    <div class="flex items-center justify-between gap-4">
      <span class="flex items-center gap-3">
        <Icon name="x" class="text-dim h-4 w-4 shrink-0" />
        <span class="font-semibold"
          >{m.settings_shortcuts_overlays_close()}</span>
      </span>
      <kbd
        class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
        {m.settings_shortcuts_escape()}
      </kbd>
    </div>
  </section>

  {#if appConfig.chatEnabled}
    <p class="text-dim mb-2 text-sm font-semibold">
      {m.settings_chat_title()}
    </p>
    <section class="card divide-border mb-4 divide-y p-5 md:p-6">
      {#each CHAT_SHORTCUTS as shortcut (shortcut.label)}
        <div
          class="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <span class="flex items-center gap-3">
            <Icon name={shortcut.icon} class="text-dim h-4 w-4 shrink-0" />
            <span class="font-semibold">{shortcut.label}</span>
          </span>
          <span class="flex items-center gap-1">
            {#each shortcut.keys as key (key)}
              <kbd
                class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
                {key}
              </kbd>
            {/each}
          </span>
        </div>
      {/each}
    </section>
  {/if}

  <p class="text-dim mb-2 text-sm font-semibold">
    {m.settings_shortcuts_jump_title()}
  </p>
  <section class="card divide-border divide-y p-5 md:p-6">
    {#each sectionShortcuts as { section, shortcut } (section.slug)}
      <div
        class="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
        <span class="flex items-center gap-3">
          <Icon name={section.icon} class="text-dim h-4 w-4 shrink-0" />
          <span class="font-semibold">{section.label}</span>
        </span>
        <kbd
          class="border-border text-dim rounded border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          {shortcut}
        </kbd>
      </div>
    {/each}
  </section>
</div>
