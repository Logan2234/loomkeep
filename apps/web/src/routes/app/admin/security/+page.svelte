<script lang="ts">
  import {
    getAdminSecurityEvents,
    getAdminSecuritySummary,
    ApiError,
  } from "$lib/api/client";
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
    AdminSecuritySummaryDto,
    SecurityEventDto,
    SecurityEventType,
  } from "@loomkeep/shared";

  const TYPE_LABELS: Record<SecurityEventType, string> = {
    USER_REGISTERED: "Inscription",
    USER_DELETED: "Suppression de compte",
    EMAIL_CHANGED: "Changement d'email",
    PASSWORD_CHANGED: "Changement de mot de passe",
    PASSWORD_RESET: "Réinitialisation de mot de passe",
    LOGIN_FAILED: "Échec de connexion",
    NEW_DEVICE_LOGIN: "Connexion depuis un nouvel appareil",
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
    { label: "Tous les types", value: "" },
    ...(Object.keys(TYPE_LABELS) as SecurityEventType[]).map((t) => ({
      label: TYPE_LABELS[t],
      value: t,
    })),
  ];

  let activeType = $state<SecurityEventType | null>(null);
  let identifierInput = $state("");
  let identifierFilter = $state("");
  let events = $state<SecurityEventDto[]>([]);
  let page = $state(1);
  let hasMore = $state(true);
  let loading = $state(false);
  let error = $state("");

  async function load(reset: boolean) {
    loading = true;
    error = "";
    const targetPage = reset ? 1 : page + 1;
    try {
      const res = await getAdminSecurityEvents({
        type: activeType ?? undefined,
        identifier: identifierFilter || undefined,
        page: targetPage,
      });
      events = reset ? res.events : [...events, ...res.events];
      page = targetPage;
      hasMore = res.events.length === 50;
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Journal indisponible";
    } finally {
      loading = false;
    }
  }

  function selectType(type: SecurityEventType | null) {
    activeType = type;
    void load(true);
  }

  let searchTimeout: ReturnType<typeof setTimeout>;
  function onIdentifierInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      identifierFilter = identifierInput.trim();
      void load(true);
    }, 300);
  }

  $effect(() => {
    void load(true);
  });

  // Failed logins only, over fixed windows — see the API for why the other
  // event types don't get a rate. Independent of the list's own filters.
  let summary = $state<AdminSecuritySummaryDto | null>(null);

  $effect(() => {
    getAdminSecuritySummary()
      .then((s) => (summary = s))
      .catch(() => (summary = null));
  });

  const kpis = $derived(
    summary
      ? [
          {
            value: formatNumber(summary.loginFailed24h),
            label: "Échecs · 24 h",
            alert: summary.loginFailed24h > 0,
          },
          { value: formatNumber(summary.loginFailed7d), label: "Échecs · 7 j" },
          {
            value: formatNumber(summary.loginFailed30d),
            label: "Échecs · 30 j",
          },
          {
            value: formatNumber(summary.loginFailedTotal),
            label: "Échecs · total",
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
    title="Sécurité"
    subtitle="Actions sensibles sur les comptes : création, suppression, changements d'identifiants, connexions échouées." />

  {#if summary}
    <KpiStrip tiles={kpis} />
    {#if targetBars.length > 0}
      <div class="card mb-5 p-4">
        <SectionLabel
          label="Identifiants les plus visés"
          badge="7 jours"
          class="mb-3" />
        <RankBars items={targetBars} />
      </div>
    {/if}
  {/if}

  <div class="mb-4 flex flex-wrap items-center gap-2">
    <Combobox
      label="Tous les types"
      options={TYPE_OPTIONS}
      values={activeType ? [activeType] : []}
      onChange={(v) => selectType((v[0] as SecurityEventType) || null)} />
  </div>

  <input
    type="text"
    bind:value={identifierInput}
    oninput={onIdentifierInput}
    placeholder="Filtrer par email ou identifiant…"
    class="border-border bg-surface mb-5 w-full rounded-lg border px-3 py-2 text-sm" />

  {#if error}
    <Banner variant="error" class="mb-4">{error}</Banner>
  {/if}

  {#if loading && events.length === 0}
    <div class="space-y-2">
      {#each { length: 6 } as _, i (i)}
        <div class="card h-16 animate-pulse"></div>
      {/each}
    </div>
  {:else if events.length === 0}
    <EmptyState>Aucun évènement ne correspond à ce filtre.</EmptyState>
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
            <span class="text-fg font-semibold">{e.identifier}</span>
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
