<script lang="ts">
  import {
    ApiError,
    getAdminImportRuns,
    getAdminImportSummary,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import KpiStrip from "$lib/components/stats/KpiStrip.svelte";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import SectionLabel from "$lib/components/stats/SectionLabel.svelte";
  import UserSelector from "$lib/components/UserSelector.svelte";
  import { IMPORTS_DEFINITION } from "$lib/constants/import-sources";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    AdminImportRunDto,
    AdminImportSummaryDto,
    JobStatus,
  } from "@loomkeep/shared";

  const sourceLabel = (id: string) =>
    Object.entries(IMPORTS_DEFINITION).find(([source, _]) => source === id)?.[1]
      .label ?? id;

  // Combobox options carry an empty-value "all" entry so a single-select clears
  // back to unfiltered.
  const SOURCE_OPTIONS = [
    { label: "Toutes les sources", value: "" },
    ...Object.entries(IMPORTS_DEFINITION).map(([source, description]) => ({
      label: description.label,
      value: source,
    })),
  ];
  const STATUS_OPTIONS = [
    { label: "Tous les statuts", value: "" },
    { label: "Réussi", value: "SUCCESS" },
    { label: m.common_failure(), value: "FAILURE" },
  ];
  const STATUS_LABELS: Record<JobStatus, string> = {
    SUCCESS: "Réussi",
    FAILURE: m.common_failure(),
  };

  let activeSource = $state("");
  let activeStatus = $state("");
  let accountId = $state<string | null>(null);
  let runs = $state<AdminImportRunDto[]>([]);
  let page = $state(1);
  let hasMore = $state(true);
  let loading = $state(false);
  let error = $state("");

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  async function load(reset: boolean) {
    loading = true;
    error = "";
    const targetPage = reset ? 1 : page + 1;
    try {
      const res = await getAdminImportRuns({
        source: activeSource || undefined,
        status: (activeStatus || undefined) as JobStatus | undefined,
        userId: accountId ?? undefined,
        page: targetPage,
      });
      runs = reset ? res.runs : [...runs, ...res.runs];
      page = targetPage;
      hasMore = res.runs.length === 50;
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Journal indisponible";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load(true);
  });

  // The summary covers the whole log, so it is loaded once and never re-queried
  // when a filter changes — it would otherwise contradict its own page header.
  let summary = $state<AdminImportSummaryDto | null>(null);

  $effect(() => {
    getAdminImportSummary()
      .then((s) => (summary = s))
      .catch(() => (summary = null));
  });

  const nf = new Intl.NumberFormat("fr-FR");

  const kpis = $derived(
    summary
      ? [
          { value: nf.format(summary.total), label: "Imports" },
          { value: nf.format(summary.success), label: "Réussis" },
          {
            value: nf.format(summary.failure),
            label: "Échecs",
            alert: summary.failure > 0,
          },
          {
            value:
              summary.successPercent === null
                ? "—"
                : String(summary.successPercent),
            unit: summary.successPercent === null ? undefined : "%",
            label: "Taux de succès",
          },
        ]
      : [],
  );

  const sourceBars = $derived(
    (summary?.bySource ?? []).map((s) => ({
      label: sourceLabel(s.sourceId),
      value: s.items,
      display: `${nf.format(s.items)} élém.`,
      badge: { text: `${s.runs} import${s.runs > 1 ? "s" : ""}` },
    })),
  );

  function durationLabel(run: AdminImportRunDto): string {
    const ms =
      new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  }
</script>

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="download"
    title="Imports"
    subtitle="Journal des imports commis, tous comptes confondus. Les analyses non validées n'écrivent rien et n'apparaissent pas ici." />

  {#if summary}
    <KpiStrip tiles={kpis} />
    {#if sourceBars.length > 0}
      <div class="card mb-5 p-4">
        <SectionLabel label="Éléments importés par source" class="mb-3" />
        <RankBars items={sourceBars} />
      </div>
    {/if}
  {/if}

  <div class="mb-5 flex flex-wrap items-center gap-2">
    <Combobox
      label="Toutes les sources"
      options={SOURCE_OPTIONS}
      values={activeSource ? [activeSource] : []}
      onChange={(v) => {
        activeSource = v[0] ?? "";
        void load(true);
      }} />
    <Combobox
      label="Tous les statuts"
      options={STATUS_OPTIONS}
      values={activeStatus ? [activeStatus] : []}
      onChange={(v) => {
        activeStatus = v[0] ?? "";
        void load(true);
      }} />
    <UserSelector
      value={accountId}
      onChange={(id) => {
        accountId = id;
        void load(true);
      }} />
  </div>

  {#if error}
    <Banner variant="error" class="mb-4">{error}</Banner>
  {/if}

  {#if loading && runs.length === 0}
    <div class="space-y-2">
      {#each { length: 6 } as _, i (i)}
        <div class="card h-20 animate-pulse"></div>
      {/each}
    </div>
  {:else if runs.length === 0}
    <EmptyState>Aucun import ne correspond à ce filtre.</EmptyState>
  {:else}
    <ul class="space-y-2">
      {#each runs as run (run.id)}
        <li class="card p-3.5">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="rounded-full border px-2 py-0.5 text-xs font-bold {run.status ===
              'SUCCESS'
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-danger/40 bg-danger/10 text-danger'}">
              {STATUS_LABELS[run.status]}
            </span>
            <span class="text-fg font-semibold"
              >{sourceLabel(run.sourceId)}</span
            ><span class="text-dim text-sm">·&nbsp;</span>
            {#if run.userId}
              <a
                href="/app/admin/users?q={encodeURIComponent(run.identifier)}"
                class="text-dim hover:text-fg text-sm underline decoration-dotted underline-offset-4"
                title="Voir ce compte">
                {run.identifier}
              </a>
            {:else}
              <span class="text-dim text-sm">{run.identifier}</span>
            {/if}
            {#if run.overwrite}
              <span
                class="border-accent/40 bg-accent/10 text-accent rounded-full border px-2 py-0.5 text-xs font-bold">
                Écrasement
              </span>
            {/if}
            <span class="timecode ml-auto text-xs">
              {dateFmt.format(new Date(run.startedAt))}
            </span>
          </div>
          <p class="text-dim mt-1.5 text-sm">
            {#if run.status === "FAILURE"}
              {run.error}
            {:else if run.summary}
              {run.summary}
            {:else}
              {run.itemCount} élément(s) importé(s)
            {/if}
            <span class="timecode">· {durationLabel(run)}</span>
          </p>
          {#if !run.userId}
            <p class="text-dim mt-1 text-xs italic">Compte supprimé depuis</p>
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
