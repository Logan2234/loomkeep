<script lang="ts">
  import { adminReports } from "$lib/admin-reports.svelte";
  import {
    ApiError,
    getAdminReports,
    getAdminReportsSummary,
    resolveAdminReport,
    takeDownAdminReport,
  } from "$lib/api/client";
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
    AdminReportsSummaryDto,
    ModerationLegalBasis,
    ReportDto,
    ReportStatus,
  } from "@loomkeep/shared";

  const STATUS_OPTIONS = [
    { label: "En attente", value: "PENDING" },
    ...(Object.keys(REPORT_STATUS_LABELS) as ReportStatus[])
      .filter((s) => s !== "PENDING")
      .map((s) => ({ label: REPORT_STATUS_LABELS[s], value: s })),
  ];

  // Must match PAGE_SIZE in apps/api/src/reports/report.service.ts.
  const PAGE_SIZE = 20;

  let activeStatus = $state<ReportStatus>("PENDING");
  let reporterId = $state<string | null>(null);
  let reports = $state<ReportDto[]>([]);
  let page = $state(1);
  let hasMore = $state(false);
  let loading = $state(false);
  let error = $state("");
  let resolvingId = $state<string | null>(null);

  async function load(reset: boolean) {
    loading = true;
    error = "";
    const targetPage = reset ? 1 : page + 1;
    try {
      const res = await getAdminReports({
        status: activeStatus,
        page: targetPage,
        reporterId: reporterId ?? undefined,
      });
      reports = reset ? res.reports : [...reports, ...res.reports];
      page = targetPage;
      hasMore = res.reports.length === PAGE_SIZE;
    } catch (err) {
      error = err instanceof ApiError ? err.message : "File indisponible";
    } finally {
      loading = false;
    }
  }

  function selectStatus(status: ReportStatus) {
    activeStatus = status;
    void load(true);
  }

  function selectReporter(id: string | null) {
    reporterId = id;
    void load(true);
  }

  async function resolve(id: string, status: "RESOLVED" | "DISMISSED") {
    resolvingId = id;
    try {
      await resolveAdminReport(id, status);
      reports = reports.filter((r) => r.id !== id);
      void adminReports.refresh();
      void loadSummary();
    } catch (err) {
      error = err instanceof ApiError ? err.message : "L'action a échoué";
    } finally {
      resolvingId = null;
    }
  }

  // DSA art. 17: the admin must state the facts and legal basis before a
  // takedown fires the notice — prefilled from the report, editable.
  let takeDownTarget = $state<ReportDto | null>(null);
  let takeDownReasonText = $state("");
  let takeDownLegalBasis = $state<ModerationLegalBasis>("TOS_BREACH");
  let takeDownTosClause = $state("");

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
  }

  async function confirmTakeDown() {
    if (!takeDownTarget) return;
    const id = takeDownTarget.id;
    resolvingId = id;
    try {
      await takeDownAdminReport(id, {
        reasonText: takeDownReasonText,
        legalBasis: takeDownLegalBasis,
        tosClause: takeDownTosClause,
      });
      reports = reports.filter((r) => r.id !== id);
      void adminReports.refresh();
      void loadSummary();
    } catch (err) {
      error = err instanceof ApiError ? err.message : "L'action a échoué";
    } finally {
      resolvingId = null;
      takeDownTarget = null;
    }
  }

  $effect(() => {
    void load(true);
  });

  // Queue-wide, so it doesn't follow the status/reporter filters — but it does
  // follow every moderation action, which moves the very counts it shows.
  let summary = $state<AdminReportsSummaryDto | null>(null);

  async function loadSummary() {
    try {
      summary = await getAdminReportsSummary();
    } catch {
      summary = null;
    }
  }

  $effect(() => {
    void loadSummary();
  });

  const kpis = $derived(
    summary
      ? [
          {
            value: formatNumber(summary.pending),
            label: "En attente",
            alert: summary.pending > 0,
          },
          { value: formatNumber(summary.resolved), label: "Résolus" },
          { value: formatNumber(summary.dismissed), label: "Rejetés" },
          {
            value:
              summary.medianResolutionHours === null
                ? "—"
                : String(summary.medianResolutionHours),
            unit: summary.medianResolutionHours === null ? undefined : "h",
            label: "Délai médian",
          },
          {
            value:
              summary.foundedPercent === null
                ? "—"
                : String(summary.foundedPercent),
            unit: summary.foundedPercent === null ? undefined : "%",
            label: "Signalements fondés",
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
    title="Signalements"
    subtitle="Commentaires (et à terme reviews/profils) signalés par les utilisateurs." />

  {#if summary}
    <KpiStrip tiles={kpis} />
    {#if reporterBars.length > 0}
      <div class="card mb-5 p-4">
        <SectionLabel label="Top signaleurs" class="mb-3" />
        <RankBars items={reporterBars} />
      </div>
    {/if}
  {/if}

  <div class="mb-5 flex flex-wrap items-center gap-2">
    <Combobox
      label={m.common_status()}
      options={STATUS_OPTIONS}
      values={[activeStatus]}
      onChange={(v) => selectStatus((v[0] as ReportStatus) || "PENDING")} />
    <UserSelector
      value={reporterId}
      label="Tous les auteurs"
      searchPlaceholder="Filtrer par auteur du signalement…"
      onChange={selectReporter} />
  </div>

  {#if error}
    <Banner variant="error" class="mb-4">{error}</Banner>
  {/if}

  {#if loading && reports.length === 0}
    <div class="space-y-2">
      {#each { length: 4 } as _, i (i)}
        <div class="card h-20 animate-pulse"></div>
      {/each}
    </div>
  {:else if reports.length === 0}
    <EmptyState>Aucun signalement pour ce statut.</EmptyState>
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
              Cible introuvable (supprimée).
            </p>
          {/if}

          <p class="text-dim mt-1 text-xs">
            Signalé par
            {#if r.reporter}
              <a
                href="/app/admin/users?q={r.reporter.username}"
                class="hover:underline">@{r.reporter.username}</a>
            {:else}
              <span class="italic">un utilisateur supprimé</span>
            {/if}
            {#if r.reason}· « {r.reason} »{/if}
          </p>

          {#if r.status === "PENDING"}
            <div class="mt-2 flex flex-wrap gap-2">
              {#if r.targetType === "COMMENT" && r.target}
                <button
                  class="btn btn-danger btn-sm"
                  disabled={resolvingId === r.id}
                  onclick={() => openTakeDown(r)}>
                  Retirer le contenu
                </button>
              {/if}
              <button
                class="btn btn-primary btn-sm"
                disabled={resolvingId === r.id}
                onclick={() => resolve(r.id, "RESOLVED")}>
                Marquer résolu
              </button>
              <button
                class="btn btn-ghost btn-sm"
                disabled={resolvingId === r.id}
                onclick={() => resolve(r.id, "DISMISSED")}>
                Rejeter
              </button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    {#if hasMore}
      <button
        class="btn btn-ghost mt-4 w-full"
        disabled={loading}
        onclick={() => load(false)}>
        {loading ? m.common_loading() : "Charger plus"}
      </button>
    {/if}
  {/if}
</div>

{#if takeDownTarget}
  <Modal
    title="Retirer le contenu signalé"
    onclose={() => (takeDownTarget = null)}>
    <p class="text-dim text-sm">
      Le commentaire est retiré (tombstone, les réponses restent visibles) et
      son auteur reçoit l'exposé des motifs (email + notification), comme
      l'exige l'art. 17 du DSA.
    </p>

    <label class="mt-4 block text-sm font-semibold" for="takedown-reason">
      Faits retenus
    </label>
    <textarea
      id="takedown-reason"
      bind:value={takeDownReasonText}
      rows="3"
      class="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 text-sm"
      placeholder="Ce qui justifie la mesure, en clair pour l'auteur."
    ></textarea>

    <label class="mt-3 block text-sm font-semibold" for="takedown-basis">
      Fondement
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
        Clause CGU
      </label>
      <input
        id="takedown-clause"
        type="text"
        bind:value={takeDownTosClause}
        class="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        placeholder="§7 — Règles de conduite" />
    {/if}

    <div class="mt-5 flex justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        disabled={resolvingId === takeDownTarget.id}
        onclick={() => (takeDownTarget = null)}>
        {m.common_cancel()}
      </button>
      <button
        type="button"
        class="btn btn-danger"
        disabled={resolvingId === takeDownTarget.id ||
          !takeDownReasonText.trim()}
        onclick={confirmTakeDown}>
        {resolvingId === takeDownTarget.id ? "Retrait…" : m.common_remove()}
      </button>
    </div>
  </Modal>
{/if}
