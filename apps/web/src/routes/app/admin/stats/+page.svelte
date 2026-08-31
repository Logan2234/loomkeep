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
  import Banner from "$lib/components/Banner.svelte";
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
  const error = $derived(
    accountsQuery.error ??
      catalogueQuery.error ??
      socialQuery.error ??
      systemQuery.error,
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

<div class="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="stats"
    title={m.admin_stats_title()}
    subtitle={m.admin_stats_subtitle()}>
    {#snippet actions()}
      <button
        onclick={refresh}
        disabled={loading}
        class="btn btn-ghost shrink-0">
        {loading ? "…" : m.common_refresh()}
      </button>
    {/snippet}
  </PageHeader>

  {#if error}
    <Banner variant="error" class="mb-6">{error}</Banner>
  {/if}

  {#if loading && !accounts}
    <div class="grid gap-3.5 lg:grid-cols-2">
      {#each { length: 4 } as _, i (i)}
        <div class="card p-4">
          <div class="skeleton h-4 w-1/3 rounded"></div>
          <div class="skeleton mt-3 h-24 w-full rounded"></div>
        </div>
      {/each}
    </div>
  {:else}
    {#if kpis.length > 0}
      <KpiStrip tiles={kpis} />
    {/if}

    {#if accounts}
      <section class="border-border border-t py-6">
        <SectionLabel label={m.admin_stats_section_accounts()} />
        <!-- Remount on refresh so the cards' own local pickers reset with it. -->
        {#key accounts.generatedAt}
          <AccountsSection stats={accounts} />
        {/key}
      </section>
    {/if}

    {#if catalogue}
      <section class="border-border border-t py-6">
        <SectionLabel label={m.admin_stats_section_catalogue()} />
        <CatalogueSection stats={catalogue} />
      </section>
    {/if}

    <!-- Dropped entirely when SOCIAL_ENABLED is off: a self-host install has
         no social surface to report on. -->
    {#if socialStats}
      <section class="border-border border-t py-6">
        <SectionLabel label={m.common_social()} badge="SOCIAL_ENABLED" />
        {#key socialStats.generatedAt}
          <SocialSection stats={socialStats} />
        {/key}
      </section>
    {/if}

    {#if system}
      <section class="border-border border-t py-6">
        <SectionLabel label={m.common_system()} />
        <SystemSection stats={system} />
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
