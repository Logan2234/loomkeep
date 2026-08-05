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
    ApiError,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import SectionLabel from "$lib/components/stats/SectionLabel.svelte";
  import { formatBytes } from "$lib/format";
  import type {
    AdminAccountsSectionDto,
    AdminCatalogueSectionDto,
    AdminSocialSectionDto,
    AdminSystemSectionDto,
  } from "@tracklore/shared";
  import AccountsSection from "./components/AccountsSection.svelte";
  import CatalogueSection from "./components/CatalogueSection.svelte";
  import KpiStrip from "./components/KpiStrip.svelte";
  import SocialSection from "./components/SocialSection.svelte";
  import SystemSection from "./components/SystemSection.svelte";

  let accounts = $state<AdminAccountsSectionDto | null>(null);
  let catalogue = $state<AdminCatalogueSectionDto | null>(null);
  let social = $state<AdminSocialSectionDto | null>(null);
  let system = $state<AdminSystemSectionDto | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      [accounts, catalogue, social, system] = await Promise.all([
        getAdminAccountsStats(),
        getAdminCatalogueStats(),
        getAdminSocialStats(),
        getAdminSystemStats(),
      ]);
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Statistiques indisponibles";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (auth.isAdmin) void load();
  });

  const nf = new Intl.NumberFormat("fr-FR");

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
        { value: nf.format(accounts.total), label: "Comptes" },
        {
          value: nf.format(accounts.health.active24h),
          label: "Actifs · 24 h",
        },
        {
          value: nf.format(accounts.health.active30d),
          label: "Actifs · 30 j",
        },
      );
    }

    if (catalogue) {
      const cached = catalogue.byDomain.reduce((sum, d) => sum + d.items, 0);
      tiles.push({ value: nf.format(cached), label: "Œuvres en cache" });
    }

    if (system) {
      const [value, unit] = formatBytes(system.databaseBytes).split(" ");
      tiles.push({ value, unit, label: "Taille BDD" });
    }

    if (socialStats) {
      tiles.push({
        value: nf.format(socialStats.reports.pending),
        label: "Signalements en attente",
        alert: socialStats.reports.pending > 0,
      });
    }

    return tiles;
  });

  const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
</script>

<div class="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="stats"
    title="Statistiques d’instance"
    subtitle="Vue d’ensemble transverse, tous comptes confondus.">
    {#snippet actions()}
      <button
        onclick={load}
        disabled={loading}
        class="btn btn-ghost shrink-0 disabled:opacity-50">
        {loading ? "…" : "Rafraîchir"}
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
        <SectionLabel label="Comptes & engagement" />
        <!-- Remount on refresh so the cards' own local pickers reset with it. -->
        {#key accounts.generatedAt}
          <AccountsSection stats={accounts} />
        {/key}
      </section>
    {/if}

    {#if catalogue}
      <section class="border-border border-t py-6">
        <SectionLabel label="Catalogue & cache" />
        <CatalogueSection stats={catalogue} />
      </section>
    {/if}

    <!-- Dropped entirely when SOCIAL_ENABLED is off: a self-host install has
         no social surface to report on. -->
    {#if socialStats}
      <section class="border-border border-t py-6">
        <SectionLabel label="Social" badge="SOCIAL_ENABLED" />
        {#key socialStats.generatedAt}
          <SocialSection stats={socialStats} />
        {/key}
      </section>
    {/if}

    {#if system}
      <section class="border-border border-t py-6">
        <SectionLabel label="Système" />
        <SystemSection stats={system} />
      </section>
    {/if}

    {#if accounts}
      <p class="text-dim mt-6 text-xs">
        Dernier rafraîchissement : {dateTimeFmt.format(
          new Date(accounts.generatedAt),
        )}
      </p>
    {/if}
  {/if}
</div>
