<script lang="ts">
  // Settings shell: the rail on the left, the open section on the right, and
  // the search results taking the section's place while a query is active.
  // The import wizards keep the full width — they are task flows with their
  // own back affordance, not a section you browse to.
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
  import { RECOVERY_CODES_LOW_THRESHOLD, sectionHref } from "./nav";
  import { settingsSearch } from "./search-state.svelte";

  let { children }: { children: Snippet } = $props();

  const isWizard = $derived(
    page.url.pathname.startsWith("/app/settings/import/"),
  );

  // Leaving settings entirely drops the query — coming back to a screen still
  // filtered by what you typed ten minutes ago is a small mystery.
  $effect(() => {
    if (!page.url.pathname.startsWith("/app/settings")) settingsSearch.clear();
  });

  // Where the rail's own back link leads, mirroring the sidebar footer: the
  // profile hub, or nothing to go back to when social is off.
  const backHref = $derived(appConfig.socialEnabled ? "/app/profile" : null);

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
  const alerts = $derived({ "double-authentification": recoveryLow });
</script>

{#if isWizard}
  {@render children()}
{:else}
  <div
    class="mx-auto flex min-h-[75dvh] max-w-3xl flex-col px-5 py-6 md:px-8 md:py-10 lg:max-w-6xl">
    {#if recoveryLow && mfa}
      <Banner variant="warning" class="mb-6 flex items-center gap-3">
        <Icon name="warning" class="h-5 w-5 shrink-0" />
        <span class="flex-1">
          {m.settings_mfa_recovery_low_warning({
            count: mfa.recoveryCodesRemaining,
          })}
        </span>
        <a
          href={sectionHref("double-authentification")}
          class="link-accent shrink-0 text-sm">
          {m.settings_recovery_codes_regenerate()}
        </a>
      </Banner>
    {/if}

    <div class="flex-1 lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10">
      <!-- The index *is* the nav on a phone, so the rail only ever shows from
           lg up; below that it would be a second copy of the same list. -->
      <aside class="hidden lg:sticky lg:top-8 lg:block lg:h-fit">
        {#if backHref}
          <a
            href={backHref}
            class="text-dim hover:text-fg mb-3 inline-flex items-center gap-1 text-sm font-semibold transition-colors">
            <Icon name="chevron-left" class="h-4 w-4" />
            {m.nav_profile()}
          </a>
        {/if}
        <div class="mb-4">
          <SettingsSearchField id="settings-search-rail" />
        </div>
        <SettingsNav variant="rail" {alerts} />
      </aside>

      <div class="min-w-0">
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
      </div>
    </div>

    <LegalLinks class="mt-10 items-center px-4 text-center" />
  </div>
{/if}
