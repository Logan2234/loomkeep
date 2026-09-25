<script lang="ts">
  // The settings index. On a phone it is the whole navigation: account
  // health first, then the five groups with each section's current value
  // under its name. On a desktop the rail already shows that list, so the
  // index hands over to the first section instead of repeating itself.
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getLastImportRun, getMfaStatus, getSessions } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { IMPORTS_DEFINITION } from "$lib/constants/import-sources";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
  import { theme } from "$lib/theme.svelte";
  import { DigestCadence } from "@loomkeep/shared";
  import SettingsNav from "./components/SettingsNav.svelte";
  import {
    LEGACY_HASH_ROUTES,
    RECOVERY_CODES_LOW_THRESHOLD,
    sectionHref,
  } from "./nav";

  // Links already out in inboxes and push payloads still point at
  // /app/settings#communications — resolve them to the route that replaced
  // the anchor rather than dropping the user on the index.
  $effect(() => {
    const target = LEGACY_HASH_ROUTES[page.url.hash.slice(1)];
    if (target) void goto(target, { replaceState: true });
  });

  $effect(() => {
    if (!browser || page.url.hash) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const openFirstSection = () => {
      if (wide.matches && page.url.pathname === "/app/settings") {
        void goto(sectionHref("security"), { replaceState: true });
      }
    };
    openFirstSection();
    wide.addEventListener("change", openFirstSection);
    return () => wide.removeEventListener("change", openFirstSection);
  });

  const mfaQuery = createApiQuery(() => ({
    key: keys.mfa.status(),
    fetch: getMfaStatus,
  }));
  const sessionsQuery = createApiQuery(() => ({
    key: keys.sessions.all(),
    fetch: getSessions,
  }));
  const lastRunQuery = createApiQuery(() => ({
    key: keys.import.lastRun(),
    fetch: getLastImportRun,
  }));
  const mfa = $derived(mfaQuery.data);
  const sessionCount = $derived(sessionsQuery.data?.length ?? 0);
  const lastRun = $derived(lastRunQuery.data?.run ?? null);

  const mfaOn = $derived(
    !!mfa &&
      (mfa.totpEnabled ||
        mfa.emailEnabled ||
        mfa.webauthnCredentials.length > 0),
  );
  const recoveryLow = $derived(
    mfaOn &&
      !!mfa &&
      mfa.recoveryCodesRemaining <= RECOVERY_CODES_LOW_THRESHOLD,
  );

  const CADENCE_PREVIEW: Record<DigestCadence, string> = {
    [DigestCadence.DISABLED]: m.settings_communications_cadence_disabled(),
    [DigestCadence.WEEKLY]: m.settings_communications_cadence_weekly(),
    [DigestCadence.DAILY]: m.settings_communications_cadence_daily(),
  };

  const LOCALE_LABELS: Record<string, string> = {
    fr: m.common_language_fr(),
    en: m.common_language_en(),
  };

  const contentPreview = $derived.by(() => {
    if (!auth.user?.birthDate) return m.settings_preview_birthdate_missing();
    return auth.user.allowAdultContent
      ? m.settings_preview_adult_on()
      : m.settings_preview_adult_off();
  });

  const importPreview = $derived.by(() => {
    if (!lastRun) return m.settings_preview_no_import();
    const source = IMPORTS_DEFINITION[lastRun.sourceId]?.label;
    return lastRun.status === "SUCCESS"
      ? m.settings_import_last_run_title({ source: source ?? lastRun.sourceId })
      : m.settings_import_last_run_failed({
          source: source ?? lastRun.sourceId,
        });
  });

  const previews = $derived({
    security: auth.user
      ? `${auth.user.username} · ${auth.user.email}`
      : undefined,
    "two-factor-authentication": mfa
      ? mfaOn
        ? m.settings_health_mfa_on()
        : m.settings_preview_mfa_off()
      : undefined,
    devices: sessionsQuery.data
      ? sessionCount > 1
        ? m.settings_health_sessions_many({ count: sessionCount })
        : m.settings_health_sessions_one({ count: sessionCount })
      : undefined,
    content: contentPreview,
    appearance: auth.user
      ? `${theme.mode === "dark" ? m.common_theme_dark() : m.common_theme_light()} · ${LOCALE_LABELS[auth.user.locale] ?? auth.user.locale}`
      : undefined,
    domains: auth.user
      ? m.settings_preview_domains({
          count: auth.user.enabledDomains.length,
          total: Object.keys(DOMAINS).length,
        })
      : undefined,
    communications: auth.user
      ? CADENCE_PREVIEW[auth.user.notifyEmail]
      : undefined,
    import: importPreview,
    export: m.settings_preview_export(),
    help: m.settings_preview_help(),
    support: m.settings_preview_support(),
    "data-sources": m.settings_preview_datasources(),
  });

  const alerts = $derived({ "two-factor-authentication": recoveryLow });
</script>

<!-- lg:hidden on the wrapper rather than per-block: above lg this route has
     already handed over to the first section. -->
<div class="lg:hidden">
  <PageHeader
    icon="gear"
    back="/app/profile"
    title={m.common_settings()}
    isNew={isFeatureNew("settings-rework")}
    class="mb-6" />

  {#if auth.user}
    <div class="mb-6 flex flex-wrap gap-2">
      <span
        class="border-border flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
        <span
          class="h-1.5 w-1.5 rounded-full {auth.user.emailVerified
            ? 'bg-success'
            : 'bg-warning'}"
          aria-hidden="true"></span>
        {auth.user.emailVerified
          ? m.settings_email_verified()
          : m.settings_email_not_verified()}
      </span>

      {#if mfa}
        <span
          class="border-border flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
          <span
            class="h-1.5 w-1.5 rounded-full {mfaOn ? 'bg-success' : 'bg-dim'}"
            aria-hidden="true"></span>
          {mfaOn ? m.settings_health_mfa_on() : m.settings_health_mfa_off()}
        </span>

        {#if mfaOn}
          <span
            class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold {recoveryLow
              ? 'border-warning text-warning'
              : 'border-border'}">
            <span
              class="h-1.5 w-1.5 rounded-full {recoveryLow
                ? 'bg-warning'
                : 'bg-success'}"
              aria-hidden="true"></span>
            {mfa.recoveryCodesRemaining > 1
              ? m.settings_health_recovery_many({
                  count: mfa.recoveryCodesRemaining,
                })
              : m.settings_health_recovery_one({
                  count: mfa.recoveryCodesRemaining,
                })}
          </span>
        {/if}
      {/if}

      {#if sessionsQuery.data}
        <a
          href={sectionHref("devices")}
          class="border-border hover:border-accent flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors">
          <Icon name="monitor" class="text-dim h-3.5 w-3.5" />
          {sessionCount > 1
            ? m.settings_health_sessions_many({ count: sessionCount })
            : m.settings_health_sessions_one({ count: sessionCount })}
        </a>
      {/if}
    </div>

    <SettingsNav variant="list" {previews} {alerts} />
  {/if}
</div>
