<script lang="ts">
  import {
    getAdminInstanceSettings,
    updateAdminInstanceSettings,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import {
    API_RATE_LIMIT_BOUNDS,
    type InstanceSettingKey,
    type UpdateInstanceSettingsDto,
  } from "@loomkeep/shared";

  type ToggleKey = Extract<
    InstanceSettingKey,
    | "socialEnabled"
    | "gamificationEnabled"
    | "registrationEnabled"
    | "publicApiEnabled"
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

  const saveMut = createApiMutation(() => ({
    mutate: (patch: UpdateInstanceSettingsDto) =>
      updateAdminInstanceSettings(patch),
    invalidates: [keys.admin.instanceSettings()],
    onSuccess: () => toast.success(m.admin_settings_saved()),
  }));

  const FEATURES: { key: ToggleKey; label: string; hint: string }[] = [
    {
      key: "socialEnabled",
      label: m.common_social(),
      hint: m.admin_settings_social_hint(),
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
  ];
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

{#snippet toggleRow(key: ToggleKey, label: string, hint: string)}
  <div class="flex items-start gap-4 p-4">
    <div class="min-w-0 flex-1">
      <p class="font-semibold">{label}</p>
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
    back="/app/admin" />

  {#if saveMut.error}
    <Banner variant="error" class="mt-4">{saveMut.error}</Banner>
  {/if}

  {#if settingsQuery.loading}
    <CardRowSkeleton count={4} />
  {:else if settingsQuery.error}
    <Banner variant="error">{settingsQuery.error}</Banner>
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
          {@render toggleRow(feature.key, feature.label, feature.hint)}
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
              <span class="text-dim block text-sm"
                >{m.admin_settings_rate_hint()}</span>
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
