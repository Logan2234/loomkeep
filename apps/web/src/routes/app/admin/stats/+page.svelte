<script lang="ts">
  // /admin/stats — "Salle des machines": the instance's operations console.
  // Four dense sections (Comptes · Catalogue · Social · Système) under a KPI
  // strip, each section loading (and failing) on its own endpoint. Metrics
  // that belong to an operational page link out to it instead of being
  // duplicated here — this page stays the cross-cutting overview.
  import {
    getAdminAccountsStats,
    getAdminCatalogueStats,
    getAdminSocialStats,
    getAdminSystemStats,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import KpiStrip from "$lib/components/stats/KpiStrip.svelte";
  import SectionLabel from "$lib/components/stats/SectionLabel.svelte";
  import {
    DATETIME_LONG_OPTIONS,
    formatDateTime,
    formatNumber,
  } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import { useQueryClient } from "@tanstack/svelte-query";
  import AccountsSection from "./components/AccountsSection.svelte";
  import CatalogueSection from "./components/CatalogueSection.svelte";
  import SocialSection from "./components/SocialSection.svelte";
  import StatsSectionError from "./components/StatsSectionError.svelte";
  import SystemSection from "./components/SystemSection.svelte";

  const queryClient = useQueryClient();
  const STATS_KEYS = [
    keys.admin.accountsStats(),
    keys.admin.catalogueStats(),
    keys.admin.socialStats(),
    keys.admin.systemStats(),
  ];

  // Each section fails independently — one down endpoint no longer blanks
  // the whole page.
  const accountsQuery = createApiQuery(() => ({
    key: keys.admin.accountsStats(),
    fetch: getAdminAccountsStats,
    enabled: auth.isAdmin,
  }));
  const catalogueQuery = createApiQuery(() => ({
    key: keys.admin.catalogueStats(),
    fetch: getAdminCatalogueStats,
    enabled: auth.isAdmin,
  }));
  const socialQuery = createApiQuery(() => ({
    key: keys.admin.socialStats(),
    fetch: getAdminSocialStats,
    enabled: auth.isAdmin,
  }));
  const systemQuery = createApiQuery(() => ({
    key: keys.admin.systemStats(),
    fetch: getAdminSystemStats,
    enabled: auth.isAdmin,
  }));

  const accounts = $derived(accountsQuery.data);
  const catalogue = $derived(catalogueQuery.data);
  const social = $derived(socialQuery.data);
  const system = $derived(systemQuery.data);
  const loading = $derived(
    accountsQuery.loading ||
      catalogueQuery.loading ||
      socialQuery.loading ||
      systemQuery.loading,
  );
  function refresh() {
    for (const key of STATS_KEYS)
      void queryClient.refetchQueries({ queryKey: key });
  }

  const socialStats = $derived(social && social.enabled ? social : null);

  /**
   * The strip is assembled from the sections' own payloads, so a tile can
   * never disagree with the card it summarises. A tile whose section failed to
   * load is dropped rather than shown as "—". "Signalements en attente" only
   * exists when social is on: with it off there is no moderation queue at all.
   */
  const kpis = $derived.by(() => {
    const tiles: {
      value: string;
      unit?: string;
      label: string;
      alert?: boolean;
    }[] = [];

    if (accounts) {
      tiles.push(
        {
          value: formatNumber(accounts.total),
          label: m.admin_stats_kpi_accounts(),
        },
        {
          value: formatNumber(accounts.health.active24h),
          label: m.admin_stats_kpi_active_24h(),
        },
        {
          value: formatNumber(accounts.health.active30d),
          label: m.admin_stats_kpi_active_30d(),
        },
      );
    }

    if (catalogue) {
      const cached = catalogue.byDomain.reduce((sum, d) => sum + d.items, 0);
      tiles.push({
        value: formatNumber(cached),
        label: m.admin_stats_kpi_cached_works(),
      });
    }

    if (socialStats) {
      tiles.push({
        value: formatNumber(socialStats.reports.pending),
        label: m.admin_stats_kpi_pending_reports(),
        alert: socialStats.reports.pending > 0,
      });
    }

    return tiles;
  });
</script>

<div>
  <PageHeader
    icon="stats"
    title={m.admin_stats_title()}
    subtitle={m.admin_stats_subtitle()}
    back="/app/admin">
    {#snippet actions()}
      <button
        onclick={refresh}
        disabled={loading}
        class="btn btn-ghost shrink-0">
        {loading ? "…" : m.common_refresh()}
      </button>
    {/snippet}
  </PageHeader>

  {#if loading && !accounts && !catalogue && !social && !system}
    <div class="animate-pulse">
      <div class="my-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {#each { length: 5 } as _, i (i)}
          <div class="card h-24 space-y-3 p-4">
            <div class="skeleton h-7 w-2/5 rounded"></div>
            <div class="skeleton h-3 w-4/5 rounded"></div>
          </div>
        {/each}
      </div>
      <section class="border-border border-t py-6">
        <div class="skeleton mb-4 h-3 w-36 rounded"></div>
        <div class="grid gap-3.5 lg:grid-cols-2">
          {#each { length: 2 } as _, i (i)}
            <div class="card h-80 space-y-5 p-4">
              <div class="skeleton h-4 w-2/5 rounded"></div>
              <div class="skeleton h-3 w-3/5 rounded"></div>
              <div class="skeleton h-40 w-full rounded"></div>
            </div>
          {/each}
        </div>
        <div class="mt-3.5 grid gap-3.5 lg:grid-cols-3">
          {#each { length: 3 } as _, i (i)}
            <div class="card h-72 space-y-5 p-4">
              <div class="skeleton h-4 w-1/2 rounded"></div>
              <div class="skeleton h-3 w-3/4 rounded"></div>
              {#each { length: 4 } as _, j (j)}
                <div class="skeleton h-3 w-full rounded"></div>
              {/each}
            </div>
          {/each}
        </div>
        <div class="mt-3.5 grid gap-3.5 lg:grid-cols-2">
          {#each { length: 2 } as _, i (i)}
            <div class="card h-64 space-y-5 p-4">
              <div class="skeleton h-4 w-1/3 rounded"></div>
              <div class="skeleton h-3 w-1/2 rounded"></div>
              <div class="skeleton h-28 w-full rounded"></div>
            </div>
          {/each}
        </div>
      </section>
    </div>
  {:else}
    {#if kpis.length > 0}
      <KpiStrip tiles={kpis} />
    {/if}

    {#if accounts || accountsQuery.error}
      <section class="border-border border-t py-6">
        <SectionLabel label={m.admin_stats_section_accounts()} />
        {#if accountsQuery.error}
          <StatsSectionError
            message={accountsQuery.error}
            onRetry={() =>
              void queryClient.refetchQueries({
                queryKey: keys.admin.accountsStats(),
              })} />
        {:else if accounts}
          <!-- Remount on refresh so the cards' own local pickers reset with it. -->
          {#key accounts.generatedAt}
            <AccountsSection stats={accounts} />
          {/key}
        {/if}
      </section>
    {/if}

    {#if catalogue || catalogueQuery.error}
      <section class="border-border border-t py-6">
        <SectionLabel label={m.admin_stats_section_catalogue()} />
        {#if catalogueQuery.error}
          <StatsSectionError
            message={catalogueQuery.error}
            onRetry={() =>
              void queryClient.refetchQueries({
                queryKey: keys.admin.catalogueStats(),
              })} />
        {:else if catalogue}
          <CatalogueSection stats={catalogue} />
        {/if}
      </section>
    {/if}

    <!-- Dropped entirely when SOCIAL_ENABLED is off: a self-host install has
         no social surface to report on. -->
    {#if socialStats || socialQuery.error}
      <section class="border-border border-t py-6">
        <SectionLabel label={m.common_social()} badge="SOCIAL_ENABLED" />
        {#if socialQuery.error}
          <StatsSectionError
            message={socialQuery.error}
            onRetry={() =>
              void queryClient.refetchQueries({
                queryKey: keys.admin.socialStats(),
              })} />
        {:else if socialStats}
          {#key socialStats.generatedAt}
            <SocialSection stats={socialStats} />
          {/key}
        {/if}
      </section>
    {/if}

    {#if system || systemQuery.error}
      <section class="border-border border-t py-6">
        <SectionLabel label={m.common_system()} />
        {#if systemQuery.error}
          <StatsSectionError
            message={systemQuery.error}
            onRetry={() =>
              void queryClient.refetchQueries({
                queryKey: keys.admin.systemStats(),
              })} />
        {:else if system}
          <SystemSection stats={system} />
        {/if}
      </section>
    {/if}

    {#if accounts}
      <p class="text-dim mt-6 text-xs">
        {m.admin_stats_last_refresh({
          date: formatDateTime(accounts.generatedAt, DATETIME_LONG_OPTIONS),
        })}
      </p>
    {/if}
  {/if}
</div>
