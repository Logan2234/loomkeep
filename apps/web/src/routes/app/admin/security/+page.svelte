<script lang="ts">
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
  import { m } from "$lib/paraglide/messages.js";
  import type {
    PagedResult,
    SecurityEventDto,
    SecurityEventType,
  } from "@loomkeep/shared";

  const TYPE_LABELS: Record<SecurityEventType, string> = {
    USER_REGISTERED: m.admin_security_registration(),
    USER_DELETED: m.admin_security_account_deletion(),
    EMAIL_CHANGED: m.admin_security_email_change(),
    PASSWORD_CHANGED: m.admin_security_password_change(),
    PASSWORD_RESET: m.admin_security_password_reset(),
    LOGIN_FAILED: m.admin_security_login_failed(),
    NEW_DEVICE_LOGIN: m.admin_security_new_device(),
  };

  const TYPE_COLORS: Record<SecurityEventType, string> = {
    USER_REGISTERED: "border-success/40 bg-success/10 text-success",
    USER_DELETED: "border-danger/40 bg-danger/10 text-danger",
    EMAIL_CHANGED: "border-accent/40 bg-accent/10 text-accent",
    PASSWORD_CHANGED: "border-accent/40 bg-accent/10 text-accent",
    PASSWORD_RESET: "border-accent/40 bg-accent/10 text-accent",
    LOGIN_FAILED: "border-danger/40 bg-danger/10 text-danger",
    NEW_DEVICE_LOGIN: "border-accent/40 bg-accent/10 text-accent",
  };

  const TYPE_OPTIONS = [
    { label: m.admin_security_all_types(), value: "" },
    ...(Object.keys(TYPE_LABELS) as SecurityEventType[]).map((t) => ({
      label: TYPE_LABELS[t],
      value: t,
    })),
  ];

  let activeType = $state<SecurityEventType | null>(null);
  let identifierInput = $state("");
  let identifierFilter = $state("");

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

  let searchTimeout: ReturnType<typeof setTimeout>;
  function onIdentifierInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      identifierFilter = identifierInput.trim();
    }, 300);
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

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="shield"
    title={m.common_security()}
    subtitle={m.admin_security_subtitle()} />

  {#if summary}
    <KpiStrip tiles={kpis} />
    {#if targetBars.length > 0}
      <div class="card mb-5 p-4">
        <SectionLabel
          label={m.admin_security_targeted_identifiers()}
          badge="7 jours"
          class="mb-3" />
        <RankBars items={targetBars} />
      </div>
    {/if}
  {/if}

  <div class="mb-4 flex flex-wrap items-center gap-2">
    <Combobox
      label={m.admin_security_all_types()}
      options={TYPE_OPTIONS}
      values={activeType ? [activeType] : []}
      onChange={(v) => (activeType = (v[0] as SecurityEventType) || null)} />
  </div>

  <input
    type="text"
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
        <div class="card h-16 animate-pulse"></div>
      {/each}
    </div>
  {:else if events.length === 0}
    <EmptyState>{m.admin_no_matching_events()}</EmptyState>
  {:else}
    <ul class="space-y-2">
      {#each events as e (e.id)}
        <li class="card p-3.5">
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
            <p class="text-dim mt-1.5 truncate text-xs">
              {#if e.detail}{e.detail}{/if}
              {#if e.detail && e.userAgent}·{/if}
              {#if e.userAgent}{e.userAgent}{/if}
            </p>
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
