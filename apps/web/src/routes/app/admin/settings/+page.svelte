<script lang="ts">
  import {
    getAdminDomainAccounts,
    getAdminInstanceSettings,
    updateAdminInstanceSettings,
  } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { initConfig } from "#lib/api/config.js";
  import { auth } from "#lib/auth.svelte.js";
  import AdminQueryError from "../AdminQueryError.svelte";
  import Banner from "#lib/components/Banner.svelte";
  import CardRowSkeleton from "#lib/components/CardRowSkeleton.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Switch from "#lib/components/Switch.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { DOCS_URL } from "#lib/constants/external-links.js";
  import { isFeatureNew, type FeatureBadgeKey } from "#lib/feature-badges.js";
  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/toast.svelte.js";
  import {
    API_RATE_LIMIT_BOUNDS,
    DOMAIN_SETTING,
    Domain,
    type InstanceDomain,
    type InstanceSettingKey,
    type UpdateInstanceSettingsDto,
  } from "@loomkeep/shared";

  type ToggleKey = Extract<
    InstanceSettingKey,
    | "socialEnabled"
    | "chatEnabled"
    | "gamificationEnabled"
    | "registrationEnabled"
    | "publicApiEnabled"
    | "updateCheckEnabled"
    | "telemetryEnabled"
    | "askAcquisitionSource"
  >;
  type LimitKey = Extract<
    InstanceSettingKey,
    "apiRateLimitFree" | "apiRateLimitPremium"
  >;

  const settingsQuery = createApiQuery(() => ({
    key: keys.admin.instanceSettings(),
    fetch: getAdminInstanceSettings,
    enabled: auth.isAdmin,
  }));
  const settings = $derived(settingsQuery.data);
  // Best effort: without the counts, the switches work all the same.
  const accountsQuery = createApiQuery(() => ({
    key: keys.admin.domainAccounts(),
    fetch: getAdminDomainAccounts,
    enabled: auth.isAdmin,
  }));

  const saveMut = createApiMutation(() => ({
    mutate: (patch: UpdateInstanceSettingsDto) =>
      updateAdminInstanceSettings(patch),
    invalidates: [keys.admin.instanceSettings()],
    onSuccess: () => {
      toast.success(m.admin_settings_saved());
      // The app read these at startup: what they show or hide changes now.
      void initConfig();
    },
  }));

  const FEATURES: {
    key: ToggleKey;
    label: string;
    hint: string;
    badge?: FeatureBadgeKey;
  }[] = [
    {
      key: "socialEnabled",
      label: m.common_social(),
      hint: m.admin_settings_social_hint(),
    },
    {
      key: "chatEnabled",
      label: m.admin_settings_chat(),
      hint: m.admin_settings_chat_hint(),
    },
    {
      key: "gamificationEnabled",
      label: m.admin_settings_gamification(),
      hint: m.admin_settings_gamification_hint(),
    },
    {
      key: "registrationEnabled",
      label: m.admin_settings_registration(),
      hint: m.admin_settings_registration_hint(),
    },
    {
      key: "updateCheckEnabled",
      label: m.admin_settings_update_check(),
      hint: m.admin_settings_update_check_hint(),
    },
    {
      key: "telemetryEnabled",
      label: m.admin_settings_telemetry(),
      hint: m.admin_settings_telemetry_hint(),
      badge: "instance-count",
    },
    {
      key: "askAcquisitionSource",
      label: m.admin_settings_acquisition(),
      hint: m.admin_settings_acquisition_hint(),
      badge: "acquisition-source",
    },
  ];
  const DOMAIN_ROWS: { domain: InstanceDomain; hint: string }[] = [
    { domain: Domain.MEDIA, hint: m.settings_domain_media_description() },
    { domain: Domain.GAMES, hint: m.settings_domain_games_description() },
    { domain: Domain.BOOKS, hint: m.settings_domain_books_description() },
    { domain: Domain.MUSIC, hint: m.settings_domain_music_description() },
  ];
  // Mirrors the API's instanceDomains: on, and with its catalogue key.
  const offered = $derived(
    DOMAIN_ROWS.filter(({ domain }) => {
      const key = DOMAIN_SETTING[domain];
      return settings?.values[key] && !settings.missingEnv[key];
    }).map(({ domain }) => domain),
  );

  const LIMITS: { key: LimitKey; label: string }[] = [
    { key: "apiRateLimitFree", label: m.admin_settings_rate_free() },
    { key: "apiRateLimitPremium", label: m.admin_settings_rate_premium() },
  ];

  function saveLimit(key: LimitKey, input: HTMLInputElement) {
    const value = Number(input.value);
    if (
      !Number.isInteger(value) ||
      value < API_RATE_LIMIT_BOUNDS.min ||
      value > API_RATE_LIMIT_BOUNDS.max ||
      value === settings?.values[key]
    ) {
      input.value = String(settings?.values[key] ?? "");
      return;
    }
    saveMut.mutate({ [key]: value });
  }
</script>

{#snippet locked(key: InstanceSettingKey)}
  {#if settings?.lockedBy[key]}
    <span class="text-dim mt-1 flex items-center gap-1 text-xs">
      <Icon name="lock" class="h-3 w-3" />
      {m.admin_settings_locked({ env: settings.lockedBy[key] })}
    </span>
  {/if}
{/snippet}

{#snippet toggleRow(
  key: ToggleKey,
  label: string,
  hint: string,
  badge?: FeatureBadgeKey,
)}
  <div class="flex items-start gap-4 p-4">
    <div class="min-w-0 flex-1">
      <p class="font-semibold">
        {label}
        {#if badge && isFeatureNew(badge)}<NewBadge />{/if}
      </p>
      <p class="text-dim text-sm">{hint}</p>
      {@render locked(key)}
    </div>
    <Switch
      {label}
      checked={settings?.values[key] ?? false}
      disabled={!!settings?.lockedBy[key] || saveMut.loading}
      onChange={(value) => saveMut.mutate({ [key]: value })} />
  </div>
{/snippet}

<div>
  <PageHeader
    icon="gear"
    title={m.admin_settings_title()}
    subtitle={m.admin_settings_subtitle()}
    back="/app/admin">
    {#snippet actions()}
      <a
        href={`${DOCS_URL}/self-hosting/instance-settings/`}
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-ghost shrink-0">
        <Icon name="book-open" class="h-4 w-4" />
        {m.admin_docs_link()}
      </a>
    {/snippet}
  </PageHeader>

  {#if saveMut.error}
    <Banner variant="error" class="mt-4">{saveMut.error}</Banner>
  {/if}

  {#if settingsQuery.loading}
    <CardRowSkeleton count={4} />
  {:else if settingsQuery.error}
    <AdminQueryError
      message={settingsQuery.error}
      queryKey={keys.admin.instanceSettings()} />
  {:else if settings}
    <section class="mt-6 flex flex-col gap-3">
      <div>
        <h2 class="font-display text-lg font-bold">
          {m.admin_settings_features()}
        </h2>
        <p class="text-dim text-sm">{m.admin_settings_features_hint()}</p>
      </div>
      <div class="card divide-border divide-y overflow-hidden">
        {#each FEATURES as feature (feature.key)}
          {@render toggleRow(
            feature.key,
            feature.label,
            feature.hint,
            feature.badge,
          )}
        {/each}
      </div>
    </section>

    <section class="mt-8 flex flex-col gap-3">
      <div>
        <h2 class="font-display text-lg font-bold">
          {m.common_domains()}
          {#if isFeatureNew("instance-domains")}<NewBadge />{/if}
        </h2>
        <p class="text-dim text-sm">{m.admin_settings_domains_hint()}</p>
      </div>
      <div class="card divide-border divide-y overflow-hidden">
        {#each DOMAIN_ROWS as { domain, hint } (domain)}
          {@const key = DOMAIN_SETTING[domain]}
          {@const missing = settings.missingEnv[key]}
          {@const isLast = offered.length === 1 && offered[0] === domain}
          <div class="flex items-start gap-4 p-4">
            <div class="min-w-0 flex-1">
              <p class="font-semibold">{DOMAINS[domain].label}</p>
              <p class="text-dim text-sm">{hint}</p>
              {#if accountsQuery.data}
                {@const count = accountsQuery.data[domain]}
                <p class="text-dim mt-1 text-xs">
                  {count === 1
                    ? m.admin_settings_domain_accounts_one({ count })
                    : m.admin_settings_domain_accounts_many({ count })}
                </p>
              {/if}
              {#if missing}
                <span class="text-warning mt-1 flex items-center gap-1 text-xs">
                  <Icon name="warning" class="h-3 w-3" />
                  {m.admin_settings_domain_missing_key({
                    env: missing.join(", "),
                  })}
                </span>
              {:else if isLast}
                <span class="text-dim mt-1 block text-xs">
                  {m.admin_settings_domain_last()}
                </span>
              {/if}
              {@render locked(key)}
            </div>
            <Switch
              label={DOMAINS[domain].label}
              checked={offered.includes(domain)}
              disabled={!!missing ||
                isLast ||
                !!settings.lockedBy[key] ||
                saveMut.loading}
              onChange={(value) => saveMut.mutate({ [key]: value })} />
          </div>
        {/each}
      </div>
    </section>

    <section class="mt-8 flex flex-col gap-3">
      <h2 class="font-display text-lg font-bold">
        {m.admin_settings_public_api()}
      </h2>
      <div class="card divide-border divide-y overflow-hidden">
        {@render toggleRow(
          "publicApiEnabled",
          m.admin_settings_public_api_enabled(),
          m.admin_settings_public_api_enabled_hint(),
        )}
        {#each LIMITS as limit (limit.key)}
          <label class="flex items-start gap-4 p-4">
            <span class="min-w-0 flex-1">
              <span class="block font-semibold">{limit.label}</span>
              <span class="text-dim block text-sm">
                {m.admin_settings_rate_hint()}
              </span>
              {@render locked(limit.key)}
            </span>
            <input
              type="number"
              inputmode="numeric"
              class="input w-28 text-right tabular-nums"
              min={API_RATE_LIMIT_BOUNDS.min}
              max={API_RATE_LIMIT_BOUNDS.max}
              value={settings.values[limit.key]}
              disabled={!!settings.lockedBy[limit.key] || saveMut.loading}
              onchange={(e) => saveLimit(limit.key, e.currentTarget)} />
          </label>
        {/each}
      </div>
    </section>
  {/if}
</div>
