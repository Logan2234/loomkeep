<script lang="ts">
  import { getAccountSecurityEvents } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { keys } from "$lib/api/keys";
  import Banner from "$lib/components/Banner.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { formatDateTime } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import type { IconName } from "$lib/types/icon-name";
  import {
    deviceLabel,
    type AccountSecurityEventDto,
    type PagedResult,
    type SecurityEventType,
  } from "@loomkeep/shared";
  import SettingsSection from "../components/SettingsSection.svelte";

  // USER_DELETED never reaches this page: the account it belongs to is gone.
  type ShownType = Exclude<SecurityEventType, "USER_DELETED">;

  const LABELS: Record<ShownType, string> = {
    USER_REGISTERED: m.settings_activity_event_user_registered(),
    EMAIL_CHANGED: m.settings_activity_event_email_changed(),
    PASSWORD_CHANGED: m.settings_activity_event_password_changed(),
    PASSWORD_RESET: m.settings_activity_event_password_reset(),
    LOGIN_FAILED: m.settings_activity_event_login_failed(),
    NEW_DEVICE_LOGIN: m.settings_activity_event_new_device_login(),
    MFA_TOTP_ENABLED: m.settings_activity_event_mfa_totp_enabled(),
    MFA_TOTP_DISABLED: m.settings_activity_event_mfa_totp_disabled(),
    MFA_EMAIL_ENABLED: m.settings_activity_event_mfa_email_enabled(),
    MFA_EMAIL_DISABLED: m.settings_activity_event_mfa_email_disabled(),
    MFA_WEBAUTHN_ADDED: m.settings_activity_event_mfa_webauthn_added(),
    MFA_WEBAUTHN_REMOVED: m.settings_activity_event_mfa_webauthn_removed(),
    MFA_WEBAUTHN_RENAMED: m.settings_activity_event_mfa_webauthn_renamed(),
    MFA_PASSWORDLESS_ENABLED:
      m.settings_activity_event_mfa_passwordless_enabled(),
    MFA_PASSWORDLESS_DISABLED:
      m.settings_activity_event_mfa_passwordless_disabled(),
    MFA_RECOVERY_CODES_REGENERATED:
      m.settings_activity_event_mfa_recovery_codes_regenerated(),
    MFA_RECOVERY_CODE_USED: m.settings_activity_event_mfa_recovery_code_used(),
    MFA_CHALLENGE_LOCKED: m.settings_activity_event_mfa_challenge_locked(),
  };

  // What might not have been the account owner stands out from their own
  // deliberate changes.
  const ALERTS: ReadonlySet<SecurityEventType> = new Set([
    "LOGIN_FAILED",
    "MFA_CHALLENGE_LOCKED",
    "MFA_RECOVERY_CODE_USED",
  ]);

  function iconFor(type: SecurityEventType): IconName {
    if (ALERTS.has(type)) return "warning";
    if (type === "NEW_DEVICE_LOGIN") return "monitor";
    if (type === "USER_REGISTERED") return "user";
    if (type === "EMAIL_CHANGED") return "mail";
    if (type === "PASSWORD_CHANGED" || type === "PASSWORD_RESET") return "key";
    return "lock";
  }

  const eventsQuery = createApiInfiniteQuery<
    PagedResult<AccountSecurityEventDto>,
    number,
    AccountSecurityEventDto
  >(() => ({
    key: keys.securityEvents.all(),
    fetch: getAccountSecurityEvents,
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
  }));
  const events = $derived(eventsQuery.data);
</script>

<SettingsSection slug="activity">
  {#if eventsQuery.error}
    <Banner variant="error" class="mb-4">{eventsQuery.error}</Banner>
  {/if}

  {#if eventsQuery.loading}
    <CardRowSkeleton count={4} />
  {:else if events.length === 0}
    <EmptyState class="px-5 py-9">
      <p class="font-semibold">{m.settings_activity_empty_title()}</p>
      <p class="mt-1 text-sm">{m.settings_activity_empty_body()}</p>
    </EmptyState>
  {:else}
    <ul class="card divide-border divide-y overflow-hidden">
      {#each events as event (event.id)}
        {@const alert = ALERTS.has(event.type)}
        <li class="flex items-start gap-4 p-4">
          <Icon
            name={iconFor(event.type)}
            class="mt-0.5 h-5 w-5 shrink-0 {alert
              ? 'text-danger'
              : 'text-dim'}" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold {alert ? 'text-danger' : ''}">
              {LABELS[event.type as ShownType]}
            </p>
            {#if event.detail}
              <p class="text-fg truncate text-sm">{event.detail}</p>
            {/if}
            <p
              class="text-dim mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
              <time class="timecode" datetime={event.createdAt}>
                {formatDateTime(event.createdAt)}
              </time>
              <span aria-hidden="true" class="bg-dim h-1 w-1 rounded-full"
              ></span>
              <span
                >{deviceLabel(event.userAgent) ??
                  m.settings_sessions_unknown_device()}</span>
              {#if event.ip}
                <span aria-hidden="true" class="bg-dim h-1 w-1 rounded-full"
                ></span>
                <span class="font-mono text-xs"
                  >{m.settings_activity_ip({ ip: event.ip })}</span>
              {/if}
            </p>
          </div>
        </li>
      {/each}
    </ul>

    {#if eventsQuery.hasNextPage}
      <button
        class="btn btn-ghost mt-4 w-full"
        disabled={eventsQuery.isFetchingNextPage}
        onclick={() => eventsQuery.fetchNextPage()}>
        {eventsQuery.isFetchingNextPage
          ? m.common_loading()
          : m.common_load_more()}
      </button>
    {/if}
  {/if}
</SettingsSection>
