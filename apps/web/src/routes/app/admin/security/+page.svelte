<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { adminFilterHref } from "$lib/admin-filter-url";
  import {
    getAdminSecurityEvents,
    getAdminSecuritySummary,
  } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import KpiStrip from "$lib/components/stats/KpiStrip.svelte";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import SectionLabel from "$lib/components/stats/SectionLabel.svelte";
  import { formatDateTime, formatNumber } from "$lib/format";
  import { debounce } from "$lib/debounce";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    PagedResult,
    SecurityEventDto,
    SecurityEventType,
  } from "@loomkeep/shared";
  import { flip } from "svelte/animate";
  import { fade } from "svelte/transition";
  import { onDestroy } from "svelte";

  const reduced = prefersReducedMotion();
  const TYPE_LABELS: Record<SecurityEventType, string> = {
    USER_REGISTERED: m.admin_security_registration(),
    USER_DELETED: m.admin_security_account_deletion(),
    EMAIL_CHANGED: m.admin_security_email_change(),
    PASSWORD_CHANGED: m.admin_security_password_change(),
    PASSWORD_RESET: m.admin_security_password_reset(),
    LOGIN_FAILED: m.admin_security_login_failed(),
    NEW_DEVICE_LOGIN: m.admin_security_new_device(),
    MFA_TOTP_ENABLED: m.admin_security_mfa_totp_enabled(),
    MFA_TOTP_DISABLED: m.admin_security_mfa_totp_disabled(),
    MFA_EMAIL_ENABLED: m.admin_security_mfa_email_enabled(),
    MFA_EMAIL_DISABLED: m.admin_security_mfa_email_disabled(),
    MFA_WEBAUTHN_ADDED: m.admin_security_mfa_webauthn_added(),
    MFA_WEBAUTHN_REMOVED: m.admin_security_mfa_webauthn_removed(),
    MFA_WEBAUTHN_RENAMED: m.admin_security_mfa_webauthn_renamed(),
    MFA_PASSWORDLESS_ENABLED: m.admin_security_mfa_passwordless_enabled(),
    MFA_PASSWORDLESS_DISABLED: m.admin_security_mfa_passwordless_disabled(),
    MFA_RECOVERY_CODES_REGENERATED:
      m.admin_security_mfa_recovery_codes_regenerated(),
    MFA_RECOVERY_CODE_USED: m.admin_security_mfa_recovery_code_used(),
    MFA_CHALLENGE_LOCKED: m.admin_security_mfa_challenge_locked(),
  };

  const TYPE_COLORS: Record<SecurityEventType, string> = {
    USER_REGISTERED: "border-success/40 bg-success/10 text-success",
    USER_DELETED: "border-danger/40 bg-danger/10 text-danger",
    EMAIL_CHANGED: "border-accent/40 bg-accent/10 text-accent",
    PASSWORD_CHANGED: "border-accent/40 bg-accent/10 text-accent",
    PASSWORD_RESET: "border-accent/40 bg-accent/10 text-accent",
    LOGIN_FAILED: "border-danger/40 bg-danger/10 text-danger",
    NEW_DEVICE_LOGIN: "border-accent/40 bg-accent/10 text-accent",
    MFA_TOTP_ENABLED: "border-success/40 bg-success/10 text-success",
    MFA_TOTP_DISABLED: "border-warning/40 bg-warning/10 text-warning",
    MFA_EMAIL_ENABLED: "border-success/40 bg-success/10 text-success",
    MFA_EMAIL_DISABLED: "border-warning/40 bg-warning/10 text-warning",
    MFA_WEBAUTHN_ADDED: "border-success/40 bg-success/10 text-success",
    MFA_WEBAUTHN_REMOVED: "border-warning/40 bg-warning/10 text-warning",
    MFA_WEBAUTHN_RENAMED: "border-accent/40 bg-accent/10 text-accent",
    MFA_PASSWORDLESS_ENABLED: "border-warning/40 bg-warning/10 text-warning",
    MFA_PASSWORDLESS_DISABLED: "border-success/40 bg-success/10 text-success",
    MFA_RECOVERY_CODES_REGENERATED: "border-accent/40 bg-accent/10 text-accent",
    MFA_RECOVERY_CODE_USED: "border-warning/40 bg-warning/10 text-warning",
    MFA_CHALLENGE_LOCKED: "border-danger/40 bg-danger/10 text-danger",
  };

  const TYPE_OPTIONS = [
    { label: m.admin_security_all_types(), value: "" },
    ...(Object.keys(TYPE_LABELS) as SecurityEventType[]).map((t) => ({
      label: TYPE_LABELS[t],
      value: t,
    })),
  ];

  const activeType = $derived<SecurityEventType | null>(
    Object.hasOwn(TYPE_LABELS, page.url.searchParams.get("type") ?? "")
      ? (page.url.searchParams.get("type") as SecurityEventType)
      : null,
  );
  let identifierInput = $state(page.url.searchParams.get("identifier") ?? "");
  const identifierFilter = $derived(
    page.url.searchParams.get("identifier") ?? "",
  );
  let copiedEventId = $state<string | null>(null);

  async function copyEvent(event: SecurityEventDto) {
    const content = [
      TYPE_LABELS[event.type],
      event.identifier,
      event.detail,
      event.userAgent,
      formatDateTime(event.createdAt),
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(content);
    copiedEventId = event.id;
    setTimeout(() => {
      if (copiedEventId === event.id) copiedEventId = null;
    }, 1500);
  }

  const eventsQuery = createApiInfiniteQuery<
    PagedResult<SecurityEventDto>,
    number,
    SecurityEventDto
  >(() => ({
    key: keys.admin.securityEvents({
      type: activeType,
      identifier: identifierFilter,
    }),
    fetch: (page) =>
      getAdminSecurityEvents({
        type: activeType ?? undefined,
        identifier: identifierFilter || undefined,
        page,
      }),
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
  }));
  const events = $derived(eventsQuery.data);
  const error = $derived(eventsQuery.error);

  const identifierDebounce = debounce(() => {
    void goto(
      adminFilterHref(page.url, { identifier: identifierInput.trim() || null }),
      { replaceState: true, noScroll: true, keepFocus: true },
    );
  }, 300);
  $effect(() => {
    identifierDebounce.cancel();
    identifierInput = page.url.searchParams.get("identifier") ?? "";
  });
  onDestroy(() => identifierDebounce.cancel());
  function onIdentifierInput() {
    identifierDebounce.call();
  }

  function changeType(type: SecurityEventType | null) {
    identifierDebounce.cancel();
    void goto(
      adminFilterHref(page.url, {
        type,
        identifier: identifierInput.trim() || null,
      }),
      { noScroll: true, keepFocus: true },
    );
  }

  // Failed logins only, over fixed windows — see the API for why the other
  // event types don't get a rate. Independent of the list's own filters.
  const summaryQuery = createApiQuery(() => ({
    key: keys.admin.securitySummary(),
    fetch: getAdminSecuritySummary,
  }));
  const summary = $derived(summaryQuery.data);

  const kpis = $derived(
    summary
      ? [
          {
            value: formatNumber(summary.loginFailed24h),
            label: m.admin_security_failures_day(),
            alert: summary.loginFailed24h > 0,
          },
          {
            value: formatNumber(summary.loginFailed7d),
            label: m.admin_security_failures_week(),
          },
          {
            value: formatNumber(summary.loginFailed30d),
            label: m.admin_security_failures_month(),
          },
          {
            value: formatNumber(summary.loginFailedTotal),
            label: m.admin_security_failures_total(),
          },
        ]
      : [],
  );

  const targetBars = $derived(
    (summary?.topTargets7d ?? []).map((t) => ({
      label: t.identifier,
      value: t.failures,
    })),
  );
</script>

<div>
  <PageHeader
    icon="shield"
    title={m.common_security()}
    subtitle={m.admin_security_subtitle()}
    back="/app/admin" />

  {#if summary}
    <KpiStrip tiles={kpis} />
    {#if targetBars.length > 0}
      <div class="card mb-5 p-4">
        <SectionLabel
          label={m.admin_security_targeted_identifiers()}
          badge={m.admin_security_seven_days()}
          class="mb-3" />
        <RankBars items={targetBars} />
      </div>
    {/if}
  {:else if summaryQuery.loading}
    <div class="animate-pulse">
      <div class="my-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {#each { length: 4 } as _, i (i)}
          <div class="card h-20 space-y-3 p-4">
            <div class="skeleton h-6 w-2/5 rounded"></div>
            <div class="skeleton h-3 w-3/4 rounded"></div>
          </div>
        {/each}
      </div>
      <div class="card mb-5 space-y-4 p-4">
        <div class="skeleton h-3 w-1/2 rounded"></div>
        <div class="space-y-2">
          <div class="flex justify-between gap-4">
            <div class="skeleton h-4 w-1/3 rounded"></div>
            <div class="skeleton h-4 w-6 rounded"></div>
          </div>
          <div class="skeleton h-2 w-full rounded"></div>
        </div>
      </div>
    </div>
  {/if}

  <div class="mb-4 flex flex-wrap items-center gap-2">
    <Combobox
      label={m.admin_security_all_types()}
      options={TYPE_OPTIONS}
      values={activeType ? [activeType] : []}
      onChange={(v) => changeType((v[0] as SecurityEventType) || null)} />
  </div>

  <input
    type="text"
    name="identifier"
    aria-label={m.admin_security_search()}
    enterkeyhint="search"
    bind:value={identifierInput}
    oninput={onIdentifierInput}
    placeholder={m.admin_security_search()}
    class="border-border bg-surface mb-5 w-full rounded-lg border px-3 py-2 text-sm" />

  {#if error}
    <Banner variant="error" class="mb-4">{error}</Banner>
  {/if}

  {#if eventsQuery.loading}
    <div class="space-y-2">
      {#each { length: 6 } as _, i (i)}
        <div class="card animate-pulse p-3.5">
          <div class="flex items-center gap-2">
            <div class="skeleton h-6 w-28 rounded-full"></div>
            <div class="skeleton h-4 w-44 rounded"></div>
            <div class="skeleton ml-auto h-3 w-28 rounded"></div>
          </div>
          <div class="skeleton mt-3 h-3 w-4/5 rounded"></div>
        </div>
      {/each}
    </div>
  {:else if events.length === 0}
    <EmptyState>{m.admin_no_matching_events()}</EmptyState>
  {:else}
    <ul class="space-y-2">
      {#each events as e (e.id)}
        <li
          animate:flip={{ duration: reduced ? 0 : 160 }}
          in:fade|global={{ duration: reduced ? 0 : 140 }}
          out:fade|global={{ duration: reduced ? 0 : 100 }}
          class="card p-3.5">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="rounded-full border px-2 py-0.5 text-xs font-bold {TYPE_COLORS[
                e.type
              ]}">
              {TYPE_LABELS[e.type]}
            </span>
            {#if e.identifier}
              <span class="text-fg font-semibold">{e.identifier}</span>
            {/if}
            <span class="text-dim ml-auto text-xs">
              {formatDateTime(e.createdAt)}
            </span>
          </div>
          {#if e.detail || e.userAgent}
            <details class="mt-2 text-xs">
              <summary
                class="text-dim hover:text-fg cursor-pointer font-semibold transition-colors">
                {m.common_details()}
              </summary>
              <div class="border-border mt-2 space-y-2 border-l pl-3">
                {#if e.detail}
                  <p class="text-fg break-words">{e.detail}</p>
                {/if}
                {#if e.userAgent}
                  <code
                    class="bg-surface-2 text-dim block overflow-x-auto rounded px-2 py-1.5 break-words whitespace-pre-wrap"
                    >{e.userAgent}</code>
                {/if}
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  onclick={() => void copyEvent(e)}>
                  {copiedEventId === e.id ? m.common_copied() : m.common_copy()}
                </button>
              </div>
            </details>
          {/if}
          {#if !e.userId}
            <p class="text-dim mt-1 text-xs italic">
              {m.admin_deleted_account()}
            </p>
          {/if}
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
</div>
