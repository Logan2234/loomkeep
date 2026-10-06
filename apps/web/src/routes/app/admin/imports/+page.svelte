<script lang="ts">
  import AdminFilterBar from "../AdminFilterBar.svelte";
  import Tooltip from "#lib/components/Tooltip.svelte";
  import ImportDetailModal from "./ImportDetailModal.svelte";
  import Banner from "#lib/components/Banner.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { adminFilterHref } from "#lib/admin-filter-url.js";
  import {
    getAdminImportRuns,
    getAdminImportSummary,
  } from "#lib/api/client.js";
  import { createApiInfiniteQuery } from "#lib/api/infinite-query.svelte.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Combobox from "#lib/components/Combobox.svelte";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import KpiStrip from "#lib/components/stats/KpiStrip.svelte";
  import RankBars from "#lib/components/stats/RankBars.svelte";
  import SectionLabel from "#lib/components/stats/SectionLabel.svelte";
  import UserSelector from "#lib/components/UserSelector.svelte";
  import { IMPORTS_DEFINITION } from "#lib/constants/import-sources.js";
  import {
    formatDateTime,
    formatDurationMs,
    formatNumber,
  } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import type {
    AdminImportRunDto,
    AdminImportStatus,
    PagedResult,
  } from "@loomkeep/shared";

  const sourceLabel = (id: string) =>
    Object.entries(IMPORTS_DEFINITION).find(([source, _]) => source === id)?.[1]
      .label ?? id;

  // Combobox options carry an empty-value "all" entry so a single-select clears
  // back to unfiltered.
  const SOURCE_OPTIONS = [
    { label: m.admin_imports_all_sources(), value: "" },
    ...Object.entries(IMPORTS_DEFINITION).map(([source, description]) => ({
      label: description.label,
      value: source,
    })),
  ];
  const STATUS_OPTIONS = [
    { label: m.admin_all_statuses(), value: "" },
    { label: m.admin_successful(), value: "SUCCESS" },
    { label: m.common_failure(), value: "FAILURE" },
    { label: m.admin_jobs_running(), value: "RUNNING" },
  ];
  const STATUS_LABELS: Record<AdminImportStatus, string> = {
    SUCCESS: m.admin_successful(),
    FAILURE: m.common_failure(),
    RUNNING: m.admin_jobs_running(),
  };

  const activeSource = $derived(page.url.searchParams.get("source") ?? "");
  const activeStatus = $derived(page.url.searchParams.get("status") ?? "");
  let selectedRun = $state<string | null>(null);
  const from = $derived(page.url.searchParams.get("from") ?? "");
  const to = $derived(page.url.searchParams.get("to") ?? "");
  function dateBoundary(value: string, inclusiveEnd = false) {
    if (!value) return undefined;
    const date = new Date(value + "T00:00:00");
    if (Number.isNaN(date.getTime())) return undefined;
    if (inclusiveEnd) date.setDate(date.getDate() + 1);
    return date.toISOString();
  }
  const accountId = $derived(page.url.searchParams.get("account") || null);
  function changeFilters(updates: Record<string, string | null>) {
    void goto(adminFilterHref(page.url, updates), {
      reset: false,
    });
  }
  function resetFilters() {
    changeFilters({
      source: null,
      status: null,
      account: null,
      from: null,
      to: null,
    });
  }
  const activeFilters = $derived([
    ...(from
      ? [
          {
            label: m.admin_date_from() + " " + from,
            remove: () => changeFilters({ from: null }),
          },
        ]
      : []),
    ...(to
      ? [
          {
            label: m.admin_date_to() + " " + to,
            remove: () => changeFilters({ to: null }),
          },
        ]
      : []),
    ...(activeSource
      ? [
          {
            label: sourceLabel(activeSource),
            remove: () => changeFilters({ source: null }),
          },
        ]
      : []),
    ...(activeStatus
      ? [
          {
            label:
              STATUS_LABELS[activeStatus as AdminImportStatus] ?? activeStatus,
            remove: () => changeFilters({ status: null }),
          },
        ]
      : []),
    ...(accountId
      ? [
          {
            label: m.common_account(),
            remove: () => changeFilters({ account: null }),
          },
        ]
      : []),
  ]);

  const runsQuery = createApiInfiniteQuery<
    PagedResult<AdminImportRunDto>,
    number,
    AdminImportRunDto
  >(() => ({
    key: keys.admin.importRuns({
      source: activeSource,
      status: activeStatus,
      userId: accountId,
      from,
      to,
    }),
    fetch: (page) =>
      getAdminImportRuns({
        source: activeSource || undefined,
        status: (activeStatus || undefined) as AdminImportStatus | undefined,
        userId: accountId ?? undefined,
        from: dateBoundary(from),
        to: dateBoundary(to, true),
        page,
      }),
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    refetchInterval: 5000,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
  }));
  const runs = $derived(runsQuery.data);
  const error = $derived(runsQuery.error);

  // The summary covers the whole log, so it is loaded once and never re-queried
  // when a filter changes — it would otherwise contradict its own page header.
  const summaryQuery = createApiQuery(() => ({
    key: keys.admin.importSummary(),
    fetch: getAdminImportSummary,
  }));
  const summary = $derived(summaryQuery.data);

  const kpis = $derived(
    summary
      ? [
          {
            value: formatNumber(summary.total),
            label: m.admin_imports_title(),
          },
          {
            value: formatNumber(summary.success),
            label: m.admin_successful_plural(),
          },
          {
            value: formatNumber(summary.failure),
            label: m.admin_failures(),
            alert: summary.failure > 0,
          },
          {
            value:
              summary.successPercent === null
                ? m.admin_metric_no_sample()
                : String(summary.successPercent),
            unit: summary.successPercent === null ? undefined : "%",
            label: m.admin_success_rate(),
          },
        ]
      : [],
  );

  const sourceBars = $derived(
    (summary?.bySource ?? []).map((s) => ({
      label: sourceLabel(s.sourceId),
      value: s.items,
      display: m.admin_imports_item_count({ count: formatNumber(s.items) }),
      badge: { text: m.admin_imports_run_count({ count: s.runs }) },
    })),
  );

  function durationLabel(run: AdminImportRunDto): string {
    if (!run.finishedAt) return m.admin_jobs_running();
    const ms =
      new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
    return formatDurationMs(ms);
  }
</script>

<div>
  <PageHeader
    icon="download"
    title={m.admin_imports_title()}
    subtitle={m.admin_imports_subtitle()}
    back="/app/admin" />

  {#if summaryQuery.error}<Banner variant="error" class="mb-4"
      >{summaryQuery.error}</Banner
    >{/if}
  {#if summary}
    <KpiStrip tiles={kpis} />
    {#if sourceBars.length > 0}
      <div class="card mb-5 p-4">
        <SectionLabel label={m.admin_imports_by_source()} class="mb-3" />
        <RankBars items={sourceBars} />
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
        <div class="skeleton h-3 w-2/5 rounded"></div>
        {#each { length: 3 } as _, i (i)}
          <div class="space-y-2">
            <div class="skeleton h-4 w-2/5 rounded"></div>
            <div class="skeleton h-2 w-full rounded"></div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <AdminFilterBar
    count={runs.length}
    loading={runsQuery.loading}
    error={!!error}
    active={activeFilters}
    onReset={resetFilters}>
    <Combobox
      label={m.admin_imports_all_sources()}
      options={SOURCE_OPTIONS}
      values={activeSource ? [activeSource] : []}
      onChange={(v) => changeFilters({ source: v[0] || null })} />
    <Combobox
      label={m.admin_all_statuses()}
      options={STATUS_OPTIONS}
      values={activeStatus ? [activeStatus] : []}
      onChange={(v) => changeFilters({ status: v[0] || null })} />
    <UserSelector
      value={accountId}
      onChange={(id) => changeFilters({ account: id })} />
    <label class="text-dim flex items-center gap-2 text-sm"
      >{m.admin_date_from()}<input
        class="input"
        type="date"
        value={from}
        max={to || undefined}
        onchange={(event) =>
          changeFilters({ from: event.currentTarget.value || null })} /></label>
    <label class="text-dim flex items-center gap-2 text-sm"
      >{m.admin_date_to()}<input
        class="input"
        type="date"
        value={to}
        min={from || undefined}
        onchange={(event) =>
          changeFilters({ to: event.currentTarget.value || null })} /></label>
  </AdminFilterBar>

  {#if error}
    <Banner variant="error" class="mb-4">{error}</Banner>
  {:else if runsQuery.loading}
    <div class="space-y-2">
      {#each { length: 6 } as _, i (i)}
        <div class="card animate-pulse p-3.5">
          <div class="flex items-center gap-2">
            <div class="skeleton h-6 w-16 rounded-full"></div>
            <div class="skeleton h-4 w-20 rounded"></div>
            <div class="skeleton h-4 w-40 rounded"></div>
            <div class="skeleton ml-auto h-3 w-24 rounded"></div>
          </div>
          <div class="skeleton mt-3 h-3 w-3/5 rounded"></div>
        </div>
      {/each}
    </div>
  {:else if runs.length === 0}
    <EmptyState
      ><p>{activeFilters.length ? m.admin_no_matches() : m.admin_no_data()}</p>
      {#if activeFilters.length}<button
          class="btn btn-ghost mt-3"
          onclick={resetFilters}>{m.admin_filters_reset()}</button
        >{/if}</EmptyState>
  {:else}
    <ul class="space-y-2">
      {#each runs as run (run.id)}
        <li class="card p-3.5">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="rounded-full border px-2 py-0.5 text-xs font-bold {run.status ===
              'SUCCESS'
                ? 'border-success/40 bg-success/10 text-success'
                : run.status === 'RUNNING'
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-danger/40 bg-danger/10 text-danger'}">
              {STATUS_LABELS[run.status]}
            </span>
            <span class="text-fg font-semibold"
              >{sourceLabel(run.sourceId)}</span
            ><span class="text-dim text-sm">·&nbsp;</span>
            {#if run.userId && run.identifier}
              <a
                href="/app/admin/users?q={encodeURIComponent(run.identifier)}"
                class="text-dim hover:text-fg text-sm underline decoration-dotted underline-offset-4"
                title={m.admin_view_account()}>
                {run.identifier}
              </a>
            {:else if run.identifier}
              <span class="text-dim text-sm">{run.identifier}</span>
            {/if}
            {#if run.overwrite}
              <Tooltip text={m.admin_imports_overwrite_help()}
                ><span
                  class="border-accent/40 bg-accent/10 text-accent rounded-full border px-2 py-0.5 text-xs font-bold">
                  {m.admin_imports_overwrite()}
                </span></Tooltip>
            {/if}
            <span class="timecode ml-auto text-xs">
              {formatDateTime(run.startedAt)}
            </span>
          </div>
          <p class="text-dim mt-1.5 text-sm">
            {#if run.status === "RUNNING"}
              {run.phase === "analyze"
                ? m.import_analyzing()
                : run.progress?.total
                  ? m.admin_imports_progress({
                      done: run.progress.done,
                      total: run.progress.total,
                    })
                  : m.admin_jobs_running()}
            {:else if run.status === "FAILURE"}
              {run.error}
            {:else if run.summary}
              {run.summary}
            {:else}
              {run.itemCount} {m.admin_imports_items_suffix()}
            {/if}
            <span class="timecode">· {durationLabel(run)}</span>
          </p>
          <button
            class="btn btn-ghost btn-sm mt-3"
            onclick={() => (selectedRun = run.id)}
            >{m.admin_imports_details()}</button>
          {#if !run.userId}
            <p class="text-dim mt-1 text-xs italic">
              {m.admin_deleted_account()}
            </p>
          {/if}
        </li>
      {/each}
    </ul>

    {#if runsQuery.hasNextPage}
      <button
        class="btn btn-ghost mt-4 w-full"
        disabled={runsQuery.isFetchingNextPage}
        onclick={() => runsQuery.fetchNextPage()}>
        {runsQuery.isFetchingNextPage
          ? m.common_loading()
          : m.common_load_more()}
      </button>
    {/if}
  {/if}
</div>

{#if selectedRun}<ImportDetailModal
    id={selectedRun}
    onclose={() => (selectedRun = null)} />{/if}
