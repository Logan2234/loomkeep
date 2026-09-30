<script lang="ts">
  import { page } from "$app/state";
  import { getApiKeys, revokeApiKey } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PremiumLockBadge from "$lib/components/PremiumLockBadge.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { appConfig } from "$lib/config.svelte";
  import CalendarSubscribeModal from "$lib/ee/calendar/CalendarSubscribeModal.svelte";
  import { useEeLock } from "$lib/ee/license.svelte";
  import ActivityFeedSubscribeModal from "$lib/ee/social/ActivityFeedSubscribeModal.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { IconName } from "$lib/types/icon-name";
  import type { ApiKeyDto } from "@loomkeep/shared";
  import { flashAnchor } from "../flash-anchor";
  import SettingsSection from "../components/SettingsSection.svelte";
  import { expiryState } from "./api-key-form";
  import ApiKeyCreateModal from "./components/ApiKeyCreateModal.svelte";
  import ApiKeyRow from "./components/ApiKeyRow.svelte";

  const apiKeysQuery = createApiQuery(() => ({
    key: keys.apiKeys.all(),
    fetch: getApiKeys,
  }));
  const apiKeys = $derived(apiKeysQuery.data ?? []);

  let creating = $state(false);
  let revoking = $state<ApiKeyDto | null>(null);
  let subscription = $state<"calendar" | "activity" | null>(null);

  const revokeMut = createApiMutation(() => ({
    mutate: (id: string) => revokeApiKey(id),
    invalidates: [keys.apiKeys.all()],
    onSuccess: () => (revoking = null),
  }));

  const eeLock = useEeLock();

  const links = $derived([
    {
      id: "calendar" as const,
      icon: "calendar" as IconName,
      label: m.settings_subscription_links_calendar(),
      formats: m.settings_subscription_links_calendar_formats(),
    },
    // The activity feed is part of the social surface.
    ...(appConfig.socialEnabled
      ? [
          {
            id: "activity" as const,
            icon: "activity" as IconName,
            label: m.settings_subscription_links_activity(),
            formats: m.settings_subscription_links_activity_formats(),
          },
        ]
      : []),
  ]);
</script>

<SettingsSection slug="integrations">
  <section
    id="api-keys"
    use:flashAnchor={{ anchor: "api-keys", hash: page.url.hash }}
    class="flex flex-col gap-3 rounded-lg">
    <h2 class="font-display text-lg font-bold">
      {m.settings_api_keys_title()}
    </h2>
    <Banner variant="info">{m.settings_api_keys_info()}</Banner>

    {#if apiKeysQuery.loading}
      <CardRowSkeleton count={2} />
    {:else if apiKeysQuery.error}
      <p class="text-danger text-sm">{apiKeysQuery.error}</p>
    {:else if apiKeys.length === 0}
      <EmptyState class="px-5 py-8">
        <p class="font-semibold">{m.settings_api_keys_empty_title()}</p>
        <p class="mt-1 text-sm">{m.settings_api_keys_empty_body()}</p>
        <button
          type="button"
          class="btn btn-primary mt-4"
          onclick={() => (creating = true)}>
          <Icon name="plus" class="h-4 w-4" />
          {m.settings_api_keys_create()}
        </button>
      </EmptyState>
    {:else}
      <div class="flex justify-end">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onclick={() => (creating = true)}>
          <Icon name="plus" class="h-4 w-4" />
          {m.settings_api_keys_create()}
        </button>
      </div>
      <div class="card divide-border divide-y overflow-hidden">
        {#each apiKeys as apiKey (apiKey.id)}
          <ApiKeyRow {apiKey} onrevoke={(key) => (revoking = key)} />
        {/each}
      </div>
    {/if}
  </section>

  <section
    id="subscription-links"
    use:flashAnchor={{ anchor: "subscription-links", hash: page.url.hash }}
    class="mt-8 flex flex-col gap-3 rounded-lg">
    <h2 class="font-display flex items-center gap-2 text-lg font-bold">
      {m.settings_subscription_links_title()}
      {#if eeLock.locked}
        <PremiumLockBadge />
      {/if}
    </h2>
    <p class="text-dim text-sm">
      {m.settings_subscription_links_description()}
    </p>
    <div class="card divide-border divide-y overflow-hidden">
      {#each links as link (link.id)}
        <div class="flex items-center gap-4 px-4 py-3">
          <Icon
            name={link.icon}
            class="text-dim hidden h-5 w-5 shrink-0 sm:block" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold">{link.label}</p>
            <p class="text-dim text-sm">{link.formats}</p>
          </div>
          {#snippet manage()}
            <button
              type="button"
              class="btn btn-ghost btn-sm shrink-0"
              disabled={eeLock.locked}
              onclick={() => (subscription = link.id)}>
              {m.common_manage()}
            </button>
          {/snippet}
          {#if eeLock.locked}
            <Tooltip text={m.premium_locked()} class="inline-flex shrink-0">
              {@render manage()}
            </Tooltip>
          {:else}
            {@render manage()}
          {/if}
        </div>
      {/each}
    </div>
  </section>
</SettingsSection>

{#if creating}
  <ApiKeyCreateModal onclose={() => (creating = false)} />
{/if}

{#if revoking}
  {@const expired = expiryState(revoking) === "expired"}
  <ConfirmationModal
    title={expired
      ? m.settings_api_keys_delete_title({ name: revoking.name })
      : m.settings_api_keys_revoke_title({ name: revoking.name })}
    message={expired
      ? m.settings_api_keys_delete_body()
      : m.settings_api_keys_revoke_body()}
    confirmLabel={expired
      ? m.common_delete()
      : m.settings_api_keys_revoke_confirm()}
    danger
    busy={revokeMut.loading}
    onConfirm={() => revoking && revokeMut.mutate(revoking.id)}
    onCancel={() => (revoking = null)} />
{/if}

{#if subscription === "calendar"}
  <CalendarSubscribeModal onclose={() => (subscription = null)} />
{:else if subscription === "activity"}
  <ActivityFeedSubscribeModal onclose={() => (subscription = null)} />
{/if}
