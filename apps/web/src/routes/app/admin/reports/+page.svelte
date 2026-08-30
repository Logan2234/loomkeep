<script lang="ts">
  import {
    getAdminReports,
    getAdminReportsSummary,
    resolveAdminReport,
    takeDownAdminReport,
  } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import KpiStrip from "$lib/components/stats/KpiStrip.svelte";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import SectionLabel from "$lib/components/stats/SectionLabel.svelte";
  import UserSelector from "$lib/components/UserSelector.svelte";
  import {
    defaultModerationBasis,
    MODERATION_LEGAL_BASIS_LABELS,
    REPORT_CATEGORY_LABELS,
    REPORT_MOTIF_LABELS,
    REPORT_STATUS_COLORS,
    REPORT_STATUS_LABELS,
  } from "$lib/constants/report-labels";
  import { formatDateTime, formatNumber } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    ModerationLegalBasis,
    PagedResult,
    ReportDto,
    ReportStatus,
  } from "@loomkeep/shared";

  const STATUS_OPTIONS = [
    { label: m.admin_social_reports_pending(), value: "PENDING" },
    ...(Object.keys(REPORT_STATUS_LABELS) as ReportStatus[])
      .filter((s) => s !== "PENDING")
      .map((s) => ({ label: REPORT_STATUS_LABELS[s], value: s })),
  ];

  let activeStatus = $state<ReportStatus>("PENDING");
  let reporterId = $state<string | null>(null);

  const reportsKey = $derived(
    keys.admin.reports({ status: activeStatus, reporterId }),
  );

  const reportsQuery = createApiInfiniteQuery<
    PagedResult<ReportDto>,
    number,
    ReportDto
  >(() => ({
    key: reportsKey,
    fetch: (page) =>
      getAdminReports({
        status: activeStatus,
        page,
        reporterId: reporterId ?? undefined,
      }),
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
  }));
  const reports = $derived(reportsQuery.data);
  const error = $derived(reportsQuery.error);

  const summaryQuery = createApiQuery(() => ({
    key: keys.admin.reportsSummary(),
    fetch: getAdminReportsSummary,
  }));
  const summary = $derived(summaryQuery.data);

  const resolveMut = createApiMutation(() => ({
    mutate: (args: { id: string; status: "RESOLVED" | "DISMISSED" }) =>
      resolveAdminReport(args.id, args.status),
    invalidates: [
      reportsKey,
      keys.admin.reportsSummary(),
      keys.admin.reportsPendingCount(),
    ],
    errorToast: true,
  }));

  // DSA art. 17: the admin must state the facts and legal basis before a
  // takedown fires the notice — prefilled from the report, editable.
  let takeDownTarget = $state<ReportDto | null>(null);
  let takeDownReasonText = $state("");
  let takeDownLegalBasis = $state<ModerationLegalBasis>("TOS_BREACH");
  let takeDownTosClause = $state("");

  const takeDownMut = createApiMutation(() => ({
    mutate: (id: string) =>
      takeDownAdminReport(id, {
        reasonText: takeDownReasonText,
        legalBasis: takeDownLegalBasis,
        tosClause: takeDownTosClause,
      }),
    onSuccess: () => {
      takeDownTarget = null;
    },
    invalidates: [
      reportsKey,
      keys.admin.reportsSummary(),
      keys.admin.reportsPendingCount(),
    ],
    coveredFields: ["reasonText", "legalBasis", "tosClause"],
  }));

  function openTakeDown(r: ReportDto) {
    takeDownTarget = r;
    takeDownReasonText =
      r.reason ??
      (r.motif
        ? REPORT_MOTIF_LABELS[r.motif]
        : r.category
          ? REPORT_CATEGORY_LABELS[r.category]
          : "");
    const defaults = defaultModerationBasis(r.category);
    takeDownLegalBasis = defaults.legalBasis;
    takeDownTosClause = defaults.tosClause;
    takeDownMut.reset();
  }

  // A report row's action buttons disable while either mutation is in
  // flight *for that row* — the two share this rather than each carrying
  // its own row-keyed pending state.
  const rowBusy = (id: string): boolean =>
    (resolveMut.loading && resolveMut.variables?.id === id) ||
    (takeDownMut.loading && takeDownMut.variables === id);

  const kpis = $derived(
    summary
      ? [
          {
            value: formatNumber(summary.pending),
            label: m.admin_social_reports_pending(),
            alert: summary.pending > 0,
          },
          {
            value: formatNumber(summary.resolved),
            label: m.admin_social_reports_resolved(),
          },
          {
            value: formatNumber(summary.dismissed),
            label: m.admin_reports_dismissed(),
          },
          {
            value:
              summary.medianResolutionHours === null
                ? "—"
                : String(summary.medianResolutionHours),
            unit: summary.medianResolutionHours === null ? undefined : "h",
            label: m.admin_social_reports_median_delay(),
          },
          {
            value:
              summary.foundedPercent === null
                ? "—"
                : String(summary.foundedPercent),
            unit: summary.foundedPercent === null ? undefined : "%",
            label: m.admin_reports_upheld(),
          },
        ]
      : [],
  );

  const reporterBars = $derived(
    (summary?.topReporters ?? []).map((r) => ({
      label: `@${r.username}`,
      value: r.reports,
    })),
  );
</script>

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="flag"
    title={m.admin_social_reports_title()}
    subtitle={m.admin_reports_subtitle()} />

  {#if summary}
    <KpiStrip tiles={kpis} />
    {#if reporterBars.length > 0}
      <div class="card mb-5 p-4">
        <SectionLabel label={m.admin_reports_top_reporters()} class="mb-3" />
        <RankBars items={reporterBars} />
      </div>
    {/if}
  {/if}

  <div class="mb-5 flex flex-wrap items-center gap-2">
    <Combobox
      label={m.common_status()}
      options={STATUS_OPTIONS}
      values={[activeStatus]}
      onChange={(v) => (activeStatus = (v[0] as ReportStatus) || "PENDING")} />
    <UserSelector
      value={reporterId}
      label={m.admin_reports_all_authors()}
      searchPlaceholder="Filtrer par auteur du signalement…"
      onChange={(id) => (reporterId = id)} />
  </div>

  {#if error}
    <Banner variant="error" class="mb-4">{error}</Banner>
  {/if}

  {#if reportsQuery.loading}
    <div class="space-y-2">
      {#each { length: 4 } as _, i (i)}
        <div class="card h-20 animate-pulse"></div>
      {/each}
    </div>
  {:else if reports.length === 0}
    <EmptyState>{m.admin_no_matching_reports()}</EmptyState>
  {:else}
    <ul class="space-y-2">
      {#each reports as r (r.id)}
        <li class="card p-3.5">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="rounded-full border px-2 py-0.5 text-xs font-bold {REPORT_STATUS_COLORS[
                r.status
              ]}">
              {REPORT_STATUS_LABELS[r.status]}
            </span>
            <span class="text-dim text-xs">{r.targetType}</span>
            {#if r.category}
              <span class="chip text-xs">
                {REPORT_CATEGORY_LABELS[r.category]}
                {#if r.motif}· {REPORT_MOTIF_LABELS[r.motif]}{/if}
              </span>
            {/if}
            <span class="text-dim ml-auto text-xs">
              {formatDateTime(r.createdAt)}
            </span>
          </div>

          {#if r.target}
            <p class="mt-1.5 text-sm">
              {#if r.target.targetOwnerUsername}
                <a
                  href="/app/admin/users?q={r.target.targetOwnerUsername}"
                  class="font-semibold hover:underline"
                  >@{r.target.targetOwnerUsername}</a>
                {#if r.target.label}·
                {/if}
              {/if}
              {#if r.target.href}
                <a href={r.target.href} class="hover:underline"
                  >{r.target.label}</a>
              {:else}
                {r.target.label}
              {/if}
            </p>
          {:else}
            <p class="text-dim mt-1.5 text-sm italic">
              {m.admin_reports_target_missing()}
            </p>
          {/if}

          <p class="text-dim mt-1 text-xs">
            {m.admin_reports_reported_by()}
            {#if r.reporter}
              <a
                href="/app/admin/users?q={r.reporter.username}"
                class="hover:underline">@{r.reporter.username}</a>
            {:else}
              <span class="italic">{m.admin_reports_deleted_user()}</span>
            {/if}
            {#if r.reason}· « {r.reason} »{/if}
          </p>

          {#if r.status === "PENDING"}
            <div class="mt-2 flex flex-wrap gap-2">
              {#if r.targetType === "COMMENT" && r.target}
                <button
                  class="btn btn-danger btn-sm"
                  disabled={rowBusy(r.id)}
                  onclick={() => openTakeDown(r)}>
                  {m.admin_reports_remove_content()}
                </button>
              {/if}
              <button
                class="btn btn-primary btn-sm"
                disabled={rowBusy(r.id)}
                onclick={() =>
                  resolveMut.mutate({ id: r.id, status: "RESOLVED" })}>
                {m.admin_reports_resolve()}
              </button>
              <button
                class="btn btn-ghost btn-sm"
                disabled={rowBusy(r.id)}
                onclick={() =>
                  resolveMut.mutate({ id: r.id, status: "DISMISSED" })}>
                {m.admin_reports_dismiss()}
              </button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    {#if reportsQuery.hasNextPage}
      <button
        class="btn btn-ghost mt-4 w-full"
        disabled={reportsQuery.isFetchingNextPage}
        onclick={() => reportsQuery.fetchNextPage()}>
        {reportsQuery.isFetchingNextPage
          ? m.common_loading()
          : m.common_load_more()}
      </button>
    {/if}
  {/if}
</div>

{#if takeDownTarget}
  <Modal
    title={m.admin_reports_remove_title()}
    onclose={() => (takeDownTarget = null)}>
    <p class="text-dim text-sm">
      {m.admin_reports_remove_description()}
    </p>

    <label class="mt-4 block text-sm font-semibold" for="takedown-reason">
      {m.admin_moderation_facts()}
    </label>
    <textarea
      id="takedown-reason"
      bind:value={takeDownReasonText}
      rows="3"
      class="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 text-sm"
      placeholder={m.admin_reports_reason_placeholder()}></textarea>

    <label class="mt-3 block text-sm font-semibold" for="takedown-basis">
      {m.admin_moderation_basis()}
    </label>
    <select
      id="takedown-basis"
      bind:value={takeDownLegalBasis}
      class="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 text-sm">
      {#each Object.entries(MODERATION_LEGAL_BASIS_LABELS) as [value, label] (value)}
        <option {value}>{label}</option>
      {/each}
    </select>

    {#if takeDownLegalBasis === "TOS_BREACH"}
      <label class="mt-3 block text-sm font-semibold" for="takedown-clause">
        {m.admin_moderation_terms_clause()}
      </label>
      <input
        id="takedown-clause"
        type="text"
        bind:value={takeDownTosClause}
        class="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        placeholder={m.admin_reports_clause_placeholder()} />
    {/if}

    {#if takeDownMut.error}
      <Banner variant="error" class="mt-3">{takeDownMut.error}</Banner>
    {:else if takeDownMut.fieldErrors.reasonText || takeDownMut.fieldErrors.legalBasis || takeDownMut.fieldErrors.tosClause}
      <Banner variant="error" class="mt-3">
        {takeDownMut.fieldErrors.reasonText ??
          takeDownMut.fieldErrors.legalBasis ??
          takeDownMut.fieldErrors.tosClause}
      </Banner>
    {/if}

    <div class="mt-5 flex justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        disabled={takeDownMut.loading}
        onclick={() => (takeDownTarget = null)}>
        {m.common_cancel()}
      </button>
      <button
        type="button"
        class="btn btn-danger"
        disabled={takeDownMut.loading || !takeDownReasonText.trim()}
        onclick={() => takeDownMut.mutate(takeDownTarget!.id)}>
        {takeDownMut.loading ? m.admin_reports_removing() : m.common_remove()}
      </button>
    </div>
  </Modal>
{/if}
