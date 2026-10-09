<script lang="ts">
  import { type ReportResolution, USER_LIMITS } from "@loomkeep/shared";

  import AdminFilterBar from "../AdminFilterBar.svelte";
  import AdminQueryError from "../AdminQueryError.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { adminFilterHref } from "#lib/admin-filter-url.js";
  import {
    deleteAdminUser,
    getAdminReports,
    getAdminReportsSummary,
    recordAdminListEdit,
    removeAdminReportedList,
    resolveAdminReport,
    takeAdminProfileMeasures,
    takeDownAdminReport,
  } from "#lib/api/client.js";
  import { createApiInfiniteQuery } from "#lib/api/infinite-query.svelte.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Banner from "#lib/components/Banner.svelte";
  import Combobox from "#lib/components/Combobox.svelte";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import SegmentedControl from "#lib/components/SegmentedControl.svelte";
  import KpiStrip from "#lib/components/stats/KpiStrip.svelte";
  import RankBars from "#lib/components/stats/RankBars.svelte";
  import SectionLabel from "#lib/components/stats/SectionLabel.svelte";
  import UserSelector from "#lib/components/UserSelector.svelte";
  import {
    defaultModerationBasis,
    MODERATION_LEGAL_BASIS_LABELS,
    REPORT_CATEGORY_LABELS,
    REPORT_MOTIF_LABELS,
    REPORT_PROFILE_PART_LABELS,
    REPORT_STATUS_COLORS,
    REPORT_STATUS_LABELS,
    REPORT_TARGET_LABELS,
  } from "#lib/constants/report-labels.js";
  import { formatDateTime, formatNumber } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type {
    ModerationLegalBasis,
    PagedResult,
    ReportDto,
    ReportStatus,
  } from "@loomkeep/shared";
  import type { Snippet } from "svelte";
  import { flip } from "svelte/animate";
  import { fade, fly, slide } from "svelte/transition";

  const reduced = prefersReducedMotion();
  const STATUS_OPTIONS = [
    { label: m.common_pending(), value: "PENDING" },
    ...(Object.keys(REPORT_STATUS_LABELS) as ReportStatus[])
      .filter((s) => s !== "PENDING")
      .map((s) => ({ label: REPORT_STATUS_LABELS[s], value: s })),
  ];

  const activeStatus = $derived<ReportStatus>(
    Object.keys(REPORT_STATUS_LABELS).includes(
      page.url.searchParams.get("status") ?? "",
    )
      ? (page.url.searchParams.get("status") as ReportStatus)
      : "PENDING",
  );
  const reporterId = $derived(page.url.searchParams.get("reporter") || null);

  function changeFilters(updates: Record<string, string | null>) {
    void goto(adminFilterHref(page.url, updates), {
      reset: false,
    });
  }

  function resetFilters() {
    changeFilters({ status: null, reporter: null });
  }
  const activeFilters = $derived([
    ...(activeStatus !== "PENDING"
      ? [
          {
            label: REPORT_STATUS_LABELS[activeStatus],
            remove: () => changeFilters({ status: null }),
          },
        ]
      : []),
    ...(reporterId
      ? [
          {
            label: m.admin_reports_all_authors(),
            remove: () => changeFilters({ reporter: null }),
          },
        ]
      : []),
  ]);
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
    mutate: (args: { id: string; status: ReportResolution }) =>
      resolveAdminReport(args.id, args.status),
    invalidates: [
      reportsKey,
      keys.admin.reportsSummary(),
      keys.admin.reportsPendingCount(),
    ],
    errorToast: true,
  }));

  // DSA art. 17: the admin must state the facts and legal basis before a
  // measure fires the notice — prefilled from the report, editable. One modal
  // for every measure; `decisionMode` picks what it applies.
  type DecisionMode = "take-down" | "list-remove" | "list-edit" | "profile";
  let takeDownTarget = $state<ReportDto | null>(null);
  let decisionMode = $state<DecisionMode>("take-down");
  let takeDownReasonText = $state("");
  let takeDownLegalBasis = $state<ModerationLegalBasis>("TOS_BREACH");
  let takeDownTosClause = $state("");

  // Profile measures combine freely; deleting the account excludes them all.
  const SUSPEND_OPTIONS = [
    ...(["7", "30", "90"] as const).map((days) => ({
      value: days,
      label: m.admin_reports_suspend_days({ count: days }),
    })),
    { value: "custom" as const, label: m.admin_reports_suspend_custom() },
  ];
  let removeAvatar = $state(false);
  let clearBio = $state(false);
  let changeName = $state(false);
  let newDisplayName = $state("");
  let suspend = $state(false);
  let suspendFor = $state<(typeof SUSPEND_OPTIONS)[number]["value"]>("7");
  let suspendDate = $state("");
  let deleteAccount = $state(false);

  const suspendUntil = $derived.by(() => {
    if (!suspend) return null;
    if (suspendFor !== "custom")
      return new Date(Date.now() + Number(suspendFor) * 86_400_000);
    const end = suspendDate ? new Date(`${suspendDate}T00:00`) : null;
    return end && end.getTime() > Date.now() ? end : null;
  });
  const profileMeasureChosen = $derived(
    deleteAccount ||
      removeAvatar ||
      clearBio ||
      (changeName && newDisplayName.trim().length > 0) ||
      suspendUntil !== null,
  );

  function applyDecision(r: ReportDto): Promise<void> {
    const reason = {
      reasonText: takeDownReasonText,
      legalBasis: takeDownLegalBasis,
      // Only a terms breach names a clause; illegality stands on its own.
      tosClause:
        takeDownLegalBasis === "TOS_BREACH" ? takeDownTosClause : undefined,
    };
    switch (decisionMode) {
      case "list-remove":
        return removeAdminReportedList(r.id, reason);
      case "list-edit":
        return recordAdminListEdit(r.id, reason);
      case "profile":
        if (deleteAccount) {
          return deleteAdminUser(r.targetId, reason).then(() =>
            resolveAdminReport(r.id, "RESOLVED"),
          );
        }
        return takeAdminProfileMeasures(r.id, {
          ...reason,
          removeAvatar,
          clearBio,
          displayName: changeName ? newDisplayName.trim() : undefined,
          suspendUntil: suspendUntil?.toISOString(),
        });
      default:
        return takeDownAdminReport(r.id, reason);
    }
  }

  const takeDownMut = createApiMutation(() => ({
    mutate: (r: ReportDto) => applyDecision(r),
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

  function openTakeDown(r: ReportDto, mode: DecisionMode = "take-down") {
    takeDownTarget = r;
    decisionMode = mode;
    removeAvatar = r.profilePart === "PHOTO";
    clearBio = r.profilePart === "BIO";
    changeName = r.profilePart === "NAME";
    newDisplayName = r.target?.label ?? "";
    suspend = false;
    suspendFor = "7";
    suspendDate = "";
    deleteAccount = false;
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
    (takeDownMut.loading && takeDownMut.variables?.id === id);

  const kpis = $derived(
    summary
      ? [
          {
            value: formatNumber(summary.pending),
            label: m.common_pending(),
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
                ? m.admin_metric_no_sample()
                : String(summary.medianResolutionHours),
            unit: summary.medianResolutionHours === null ? undefined : "h",
            label: m.admin_social_reports_median_delay(),
          },
          {
            value:
              summary.foundedPercent === null
                ? m.admin_metric_no_sample()
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

<div>
  <PageHeader
    icon="flag"
    title={m.admin_social_reports_title()}
    subtitle={m.admin_reports_subtitle()}
    back="/app/admin" />

  {#if !appConfig.socialEnabled}<Banner variant="info" class="mb-4"
      >{m.admin_social_disabled()}</Banner
    >{/if}
  {#if summaryQuery.error}<AdminQueryError
      message={summaryQuery.error}
      queryKey={keys.admin.reportsSummary()} />{/if}
  {#if summary}
    <KpiStrip tiles={kpis} />
    {#if reporterBars.length > 0}
      <div class="card mb-5 p-4">
        <SectionLabel label={m.admin_reports_top_reporters()} class="mb-3" />
        <RankBars items={reporterBars} />
      </div>
    {/if}
  {:else if summaryQuery.loading}
    <div class="animate-pulse">
      <div class="my-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {#each { length: 5 } as _, i (i)}
          <div class="card h-20 space-y-3 p-4">
            <div class="skeleton h-6 w-2/5 rounded"></div>
            <div class="skeleton h-3 w-3/4 rounded"></div>
          </div>
        {/each}
      </div>
      <div class="card mb-5 space-y-4 p-4">
        <div class="skeleton h-3 w-1/3 rounded"></div>
        {#each { length: 4 } as _, i (i)}
          <div class="space-y-2">
            <div class="flex justify-between gap-4">
              <div class="skeleton h-4 w-1/4 rounded"></div>
              <div class="skeleton h-4 w-6 rounded"></div>
            </div>
            <div class="skeleton h-2 w-full rounded"></div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <AdminFilterBar
    count={reports.length}
    loading={reportsQuery.loading}
    error={!!error}
    active={activeFilters}
    onReset={resetFilters}>
    <Combobox
      label={m.common_status()}
      options={STATUS_OPTIONS}
      values={[activeStatus]}
      onChange={(v) =>
        changeFilters({
          status: v[0] && v[0] !== "PENDING" ? v[0] : null,
        })} />
    <UserSelector
      value={reporterId}
      label={m.admin_reports_all_authors()}
      searchPlaceholder={m.admin_reports_author_search()}
      onChange={(id) => changeFilters({ reporter: id })} />
  </AdminFilterBar>

  {#if error}
    <AdminQueryError message={error} queryKey={reportsKey} />
  {:else if reportsQuery.loading}
    <div class="space-y-2">
      {#each { length: 4 } as _, i (i)}
        <div class="card animate-pulse p-3.5">
          <div class="flex items-center gap-2">
            <div class="skeleton h-6 w-20 rounded-full"></div>
            <div class="skeleton h-3 w-16 rounded"></div>
            <div class="skeleton h-6 w-52 rounded-full"></div>
            <div class="skeleton ml-auto h-3 w-28 rounded"></div>
          </div>
          <div class="skeleton mt-3 h-4 w-4/5 rounded"></div>
          <div class="skeleton mt-2 h-3 w-2/5 rounded"></div>
          <div class="mt-3 flex gap-2">
            <div class="skeleton h-8 w-32 rounded-lg"></div>
            <div class="skeleton h-8 w-28 rounded-lg"></div>
            <div class="skeleton h-8 w-20 rounded-lg"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if reports.length === 0}
    <EmptyState
      ><p>
        {activeFilters.length
          ? m.admin_no_matches()
          : m.admin_no_matching_reports()}
      </p>
      {#if activeFilters.length}<button
          class="btn btn-ghost mt-3"
          onclick={resetFilters}>{m.admin_filters_reset()}</button
        >{/if}</EmptyState>
  {:else}
    <ul class="space-y-2">
      {#each reports as r (r.id)}
        <li
          animate:flip={{ duration: reduced ? 0 : 160 }}
          in:fade|global={{ duration: reduced ? 0 : 140 }}
          out:fade|global={{ duration: reduced ? 0 : 100 }}
          class="card p-3.5">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="rounded-full border px-2 py-0.5 text-xs font-bold {REPORT_STATUS_COLORS[
                r.status
              ]}">
              {REPORT_STATUS_LABELS[r.status]}
            </span>
            <span class="text-dim text-xs">
              {REPORT_TARGET_LABELS[r.targetType]}
              {#if r.profilePart}
                · {REPORT_PROFILE_PART_LABELS[r.profilePart]}
              {/if}
            </span>
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
            {#if r.target.context?.length}
              <ol
                class="border-border bg-surface-2/50 mt-2 space-y-1 rounded-lg border p-2.5 text-xs"
                aria-label={m.admin_reports_message_context()}>
                {#each r.target.context as line, i (i)}
                  <li
                    class="flex gap-2 {line.reported
                      ? 'text-fg bg-danger/10 rounded px-1 font-semibold'
                      : 'text-dim'}">
                    <span class="shrink-0 font-mono">
                      {formatDateTime(line.createdAt)}
                    </span>
                    <span class="shrink-0"
                      >@{line.authorUsername ??
                        m.admin_reports_deleted_user()}</span>
                    <span class="min-w-0 break-words whitespace-pre-wrap"
                      >{line.text ?? m.chat_message_deleted()}</span>
                  </li>
                {/each}
              </ol>
            {/if}
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
              {#if (r.targetType === "COMMENT" || r.targetType === "REVIEW" || r.targetType === "MESSAGE") && r.target}
                <button
                  class="btn btn-danger btn-sm"
                  disabled={rowBusy(r.id)}
                  onclick={() => openTakeDown(r)}>
                  {m.admin_reports_remove_content()}
                </button>
              {:else if r.targetType === "USER" && r.target}
                <button
                  class="btn btn-danger btn-sm"
                  disabled={rowBusy(r.id)}
                  onclick={() => openTakeDown(r, "profile")}>
                  {m.admin_reports_take_measure()}
                </button>
              {:else if r.targetType === "LIST" && r.target}
                {#if r.target.href}
                  <a class="btn btn-ghost btn-sm" href={r.target.href}>
                    {m.admin_reports_list_open()}
                  </a>
                {/if}
                <button
                  class="btn btn-primary btn-sm"
                  disabled={rowBusy(r.id)}
                  onclick={() => openTakeDown(r, "list-edit")}>
                  {m.admin_reports_list_record_edit()}
                </button>
                <button
                  class="btn btn-danger btn-sm"
                  disabled={rowBusy(r.id)}
                  onclick={() => openTakeDown(r, "list-remove")}>
                  {m.admin_reports_list_remove()}
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
  {@const target = takeDownTarget}
  <Modal
    title={decisionMode === "profile"
      ? m.admin_reports_measure_title({
          username: `@${target.target?.targetOwnerUsername ?? ""}`,
        })
      : decisionMode === "list-remove"
        ? m.admin_reports_list_remove()
        : decisionMode === "list-edit"
          ? m.admin_reports_list_record_edit()
          : m.admin_reports_remove_title()}
    onclose={() => (takeDownTarget = null)}>
    {#if decisionMode === "profile"}
      {#if target.profilePart}
        <p class="text-dim text-sm">
          {m.admin_reports_reported_part({
            part: REPORT_PROFILE_PART_LABELS[target.profilePart],
          })}
          {#if target.category}
            · {REPORT_CATEGORY_LABELS[target.category]}
            {#if target.motif}· {REPORT_MOTIF_LABELS[target.motif]}{/if}
          {/if}
        </p>
      {/if}
      <div
        class="border-border divide-border mt-3 divide-y rounded-lg border px-3">
        {@render measureRow(
          "measure-avatar",
          m.admin_reports_measure_avatar(),
          m.admin_reports_measure_avatar_hint(),
          () => removeAvatar,
          (v) => (removeAvatar = v),
        )}
        {@render measureRow(
          "measure-bio",
          m.admin_reports_measure_bio(),
          null,
          () => clearBio,
          (v) => (clearBio = v),
        )}
        {@render measureRow(
          "measure-name",
          m.admin_reports_measure_name(),
          m.admin_reports_measure_name_hint(),
          () => changeName,
          (v) => (changeName = v),
          nameInput,
        )}
        {@render measureRow(
          "measure-suspend",
          m.admin_reports_measure_suspend(),
          m.admin_reports_measure_suspend_hint(),
          () => suspend,
          (v) => (suspend = v),
          suspendPicker,
        )}
        <label class="flex cursor-pointer items-start gap-2.5 py-2.5">
          <input
            id="measure-delete"
            type="checkbox"
            class="accent-danger mt-0.5 h-4 w-4 shrink-0"
            bind:checked={deleteAccount} />
          <span>
            <span class="text-danger block text-sm font-semibold">
              {m.admin_reports_measure_delete()}
            </span>
            <span class="text-dim block text-xs">
              {m.admin_reports_measure_delete_hint()}
            </span>
          </span>
        </label>
      </div>
      {#if suspendUntil && !deleteAccount}
        <p
          class="bg-surface-2 text-dim mt-3 rounded-lg px-3 py-2 text-xs"
          transition:slide={{ duration: reduced ? 0 : 180 }}>
          {m.admin_reports_suspend_effects({
            date: formatDateTime(suspendUntil),
          })}
        </p>
      {/if}
    {:else}
      <p class="text-dim text-sm">
        {decisionMode === "list-remove"
          ? m.admin_reports_list_remove_description()
          : decisionMode === "list-edit"
            ? m.admin_reports_list_edit_description()
            : m.admin_reports_remove_description()}
      </p>
    {/if}

    <label class="mt-4 block text-sm font-semibold" for="takedown-reason">
      {m.admin_moderation_facts()}
    </label>
    <textarea
      id="takedown-reason"
      name="reasonText"
      bind:value={takeDownReasonText}
      rows="3"
      class="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 text-sm"
      placeholder={m.admin_reports_reason_placeholder()}></textarea>
    {@render fieldError(takeDownMut.fieldErrors.reasonText)}

    <span class="mt-3 block text-sm font-semibold">
      {m.admin_moderation_basis()}
    </span>
    <Combobox
      label={m.admin_moderation_basis()}
      name="legalBasis"
      options={Object.entries(MODERATION_LEGAL_BASIS_LABELS).map(
        ([value, label]) => ({
          label,
          value,
        }),
      )}
      values={[takeDownLegalBasis]}
      onChange={(v) => (takeDownLegalBasis = v[0] as ModerationLegalBasis)} />
    {@render fieldError(takeDownMut.fieldErrors.legalBasis)}

    {#if takeDownLegalBasis === "TOS_BREACH"}
      <label class="mt-3 block text-sm font-semibold" for="takedown-clause">
        {m.admin_moderation_terms_clause()}
      </label>
      <input
        id="takedown-clause"
        type="text"
        name="tosClause"
        bind:value={takeDownTosClause}
        class="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        placeholder={m.moderation_terms_conduct()} />
      {@render fieldError(takeDownMut.fieldErrors.tosClause)}
    {/if}

    {#if takeDownMut.error}
      <Banner variant="error" class="mt-3">{takeDownMut.error}</Banner>
    {/if}

    {#snippet actions()}
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          disabled={takeDownMut.loading}
          onclick={() => (takeDownTarget = null)}>
          {m.common_cancel()}
        </button>
        <button
          type="button"
          class="btn {decisionMode === 'list-edit' ||
          (decisionMode === 'profile' && !deleteAccount)
            ? 'btn-primary'
            : 'btn-danger'}"
          disabled={takeDownMut.loading ||
            !takeDownReasonText.trim() ||
            (decisionMode === "profile" && !profileMeasureChosen)}
          onclick={() => takeDownMut.mutate(target)}>
          {#if takeDownMut.loading}
            {decisionMode === "take-down"
              ? m.admin_reports_removing()
              : m.common_loading()}
          {:else if decisionMode === "profile"}
            {deleteAccount
              ? m.admin_reports_measure_delete()
              : m.common_apply()}
          {:else if decisionMode === "list-edit"}
            {m.admin_reports_record()}
          {:else if decisionMode === "list-remove"}
            {m.common_delete()}
          {:else}
            {m.common_remove()}
          {/if}
        </button>
      </div>
    {/snippet}
  </Modal>
{/if}

{#snippet measureRow(
  id: string,
  label: string,
  hint: string | null,
  get: () => boolean,
  set: (value: boolean) => void,
  extra: Snippet | null = null,
)}
  <div class="py-2.5">
    <label
      class="flex cursor-pointer items-start gap-2.5 {deleteAccount
        ? 'opacity-50'
        : ''}">
      <input
        {id}
        type="checkbox"
        class="accent-accent mt-0.5 h-4 w-4 shrink-0"
        disabled={deleteAccount}
        checked={get() && !deleteAccount}
        onchange={(e) => set(e.currentTarget.checked)} />
      <span>
        <span class="block text-sm font-semibold">{label}</span>
        {#if hint}<span class="text-dim block text-xs">{hint}</span>{/if}
      </span>
    </label>
    <!-- The row's own input sits inside it, under its label: the divider
         stays above the whole row instead of cutting it in two. -->
    {#if extra && get() && !deleteAccount}
      <div
        class="pt-2.5 pl-6.5"
        transition:slide={{ duration: reduced ? 0 : 180 }}>
        {@render extra()}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet nameInput()}
  <input
    id="measure-name-value"
    class="input text-sm"
    maxlength={USER_LIMITS.displayName}
    aria-label={m.admin_reports_measure_name_label()}
    placeholder={m.admin_reports_measure_name_label()}
    bind:value={newDisplayName} />
{/snippet}

{#snippet suspendPicker()}
  <SegmentedControl
    label={m.admin_reports_suspend_end()}
    options={SUSPEND_OPTIONS}
    value={suspendFor}
    onChange={(v) => (suspendFor = v)} />
  {#if suspendFor === "custom"}
    <div class="pt-2" transition:slide={{ duration: reduced ? 0 : 180 }}>
      <input
        id="measure-suspend-date"
        type="date"
        class="input w-auto text-sm"
        aria-label={m.admin_reports_suspend_end()}
        bind:value={suspendDate} />
    </div>
  {/if}
{/snippet}

{#snippet fieldError(message: string | undefined)}
  {#if message}
    <p
      class="text-danger mt-1 text-xs"
      transition:fly={{ y: reduced ? 0 : -4, duration: reduced ? 0 : 160 }}>
      {message}
    </p>
  {/if}
{/snippet}
