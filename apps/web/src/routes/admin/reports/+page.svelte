<script lang="ts">
  import {
    ApiError,
    getAdminReports,
    getAdminReportsSummary,
    resolveAdminReport,
    takeDownAdminReport,
  } from "$lib/api/client";
  import { adminReports } from "$lib/admin-reports.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import KpiStrip from "$lib/components/stats/KpiStrip.svelte";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import SectionLabel from "$lib/components/stats/SectionLabel.svelte";
  import UserSelector from "$lib/components/UserSelector.svelte";
  import {
    REPORT_CATEGORY_LABELS,
    REPORT_MOTIF_LABELS,
    REPORT_STATUS_COLORS,
    REPORT_STATUS_LABELS,
  } from "$lib/report-labels";
  import type {
    AdminReportsSummaryDto,
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

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

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

  let confirmTakeDownId = $state<string | null>(null);

  async function confirmTakeDown() {
    if (!confirmTakeDownId) return;
    const id = confirmTakeDownId;
    resolvingId = id;
    try {
      await takeDownAdminReport(id);
      reports = reports.filter((r) => r.id !== id);
      void adminReports.refresh();
      void loadSummary();
    } catch (err) {
      error = err instanceof ApiError ? err.message : "L'action a échoué";
    } finally {
      resolvingId = null;
      confirmTakeDownId = null;
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

  const nf = new Intl.NumberFormat("fr-FR");

  const kpis = $derived(
    summary
      ? [
          {
            value: nf.format(summary.pending),
            label: "En attente",
            alert: summary.pending > 0,
          },
          { value: nf.format(summary.resolved), label: "Résolus" },
          { value: nf.format(summary.dismissed), label: "Rejetés" },
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
      label="Statut"
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
              {dateFmt.format(new Date(r.createdAt))}
            </span>
          </div>

          {#if r.target}
            <p class="mt-1.5 text-sm">
              {#if r.target.targetOwnerUsername}
                <a
                  href="/admin/users?q={r.target.targetOwnerUsername}"
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
            <a
              href="/admin/users?q={r.reporter.username}"
              class="hover:underline">@{r.reporter.username}</a>
            {#if r.reason}· « {r.reason} »{/if}
          </p>

          {#if r.status === "PENDING"}
            <div class="mt-2 flex flex-wrap gap-2">
              {#if r.targetType === "COMMENT" && r.target}
                <button
                  class="btn btn-danger btn-sm"
                  disabled={resolvingId === r.id}
                  onclick={() => (confirmTakeDownId = r.id)}>
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
        {loading ? "Chargement…" : "Charger plus"}
      </button>
    {/if}
  {/if}
</div>

{#if confirmTakeDownId}
  <ConfirmationModal
    title="Retirer le contenu signalé"
    message="Le commentaire est retiré (tombstone, les réponses restent visibles) et le signalement passe à Résolu."
    confirmLabel="Retirer"
    danger
    busy={resolvingId === confirmTakeDownId}
    onConfirm={confirmTakeDown}
    onCancel={() => (confirmTakeDownId = null)} />
{/if}
