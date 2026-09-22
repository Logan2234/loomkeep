<script lang="ts">
  // Settings shell: the rail on the left, the open section on the right, and
  // the search results taking the section's place while a query is active.
  // The import wizards keep the full width — they are task flows with their
  // own back affordance, not a section you browse to.
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getMfaStatus } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import LegalLinks from "$lib/components/LegalLinks.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import SettingsNav from "./components/SettingsNav.svelte";
  import SettingsSearchField from "./components/SettingsSearchField.svelte";
  import SettingsSearchResults from "./components/SettingsSearchResults.svelte";
  import {
    numberedSettingsSection,
    settingsShortcutIndex,
  } from "./keyboard-navigation";
  import {
    RECOVERY_CODES_LOW_THRESHOLD,
    SETTINGS_SECTIONS,
    sectionHref,
  } from "./nav";
  import { settingsSearch } from "./search-state.svelte";

  let { children }: { children: Snippet } = $props();

  const isWizard = $derived(
    page.url.pathname.startsWith("/app/settings/import/") &&
      page.url.pathname !== "/app/settings/import/history",
  );

  // Leaving settings entirely drops the query — coming back to a screen still
  // filtered by what you typed ten minutes ago is a small mystery.
  $effect(() => {
    if (!page.url.pathname.startsWith("/app/settings")) settingsSearch.clear();
  });

  // Shared cache entry with the 2FA section, so this costs one request for
  // the whole of settings. It is what moves the "running out of recovery
  // codes" warning out of a card nobody scrolls to.
  const mfaQuery = createApiQuery(() => ({
    key: keys.mfa.status(),
    fetch: getMfaStatus,
  }));
  const mfa = $derived(mfaQuery.data);
  const recoveryLow = $derived(
    !!mfa &&
      (mfa.totpEnabled ||
        mfa.emailEnabled ||
        mfa.webauthnCredentials.length > 0) &&
      mfa.recoveryCodesRemaining <= RECOVERY_CODES_LOW_THRESHOLD,
  );
  const alerts = $derived({ "two-factor-authentication": recoveryLow });

  const visibleSections = $derived(
    SETTINGS_SECTIONS.filter(
      (section) => !section.social || appConfig.socialEnabled,
    ),
  );

  function isShortcutTarget(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    return !!target?.closest(
      "input, textarea, select, button, a, [contenteditable='true'], [role='button'], [role='tab']",
    );
  }

  function onSettingsKeydown(event: KeyboardEvent) {
    const shortcutIndex = settingsShortcutIndex(event.code, event.shiftKey);
    if (
      isWizard ||
      !event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      shortcutIndex === null ||
      isShortcutTarget(event)
    ) {
      return;
    }

    const next = numberedSettingsSection(shortcutIndex, visibleSections);
    if (!next) return;

    event.preventDefault();
    settingsSearch.clear();
    void goto(sectionHref(next.slug));
  }
</script>

<svelte:window onkeydown={onSettingsKeydown} />

{#if isWizard}
  {@render children()}
{:else}
  <div
    class="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-6 md:px-8 md:py-10 lg:max-w-6xl">
    {#if recoveryLow && mfa}
      <Banner variant="warning" class="mb-6 flex items-center gap-3">
        <Icon name="warning" class="h-5 w-5 shrink-0" />
        <span class="flex-1">
          {m.settings_mfa_recovery_low_warning({
            count: mfa.recoveryCodesRemaining,
          })}
        </span>
        <a
          href={sectionHref("two-factor-authentication")}
          class="link-accent shrink-0 text-sm">
          {m.settings_recovery_codes_regenerate()}
        </a>
      </Banner>
    {/if}

    <div class="flex-1 lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-10">
      <!-- The index *is* the nav on a phone, so the rail only ever shows from
           lg up; below that it would be a second copy of the same list. -->
      <aside class="hidden lg:sticky lg:top-8 lg:block lg:h-fit">
        <div class="mb-4">
          <SettingsSearchField id="settings-search-rail" />
        </div>
        <SettingsNav variant="rail" {alerts} />
      </aside>

      <div class="min-w-0 lg:flex lg:flex-col">
        <!-- On a phone the field rides above the content instead, since the
             rail it normally sits in isn't rendered. -->
        <div class="mb-6 lg:hidden">
          <SettingsSearchField id="settings-search-content" />
        </div>

        {#if settingsSearch.active}
          <SettingsSearchResults />
        {:else}
          {@render children()}
        {/if}

        <!-- On desktop, the legal footer belongs to the reading column, not
             to the rail plus content shell. `mt-auto` keeps it at the foot
             of a short section without centring it under the navigation. -->
        <LegalLinks class="mt-10 items-center px-4 text-center lg:mt-auto" />
      </div>
    </div>
  </div>
{/if}
