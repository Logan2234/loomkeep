<script lang="ts">
  import { ApiError, getAdminServices } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import KpiStrip from "$lib/components/stats/KpiStrip.svelte";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import SectionLabel from "$lib/components/stats/SectionLabel.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { m } from "$lib/paraglide/messages.js";
  import type { ServiceStatusDto } from "@loomkeep/shared";

  let services = $state<ServiceStatusDto[] | null>(null);
  let checkedAt = $state<string | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      const res = await getAdminServices();
      services = res.services;
      checkedAt = res.checkedAt;
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : m.admin_services_fetch_error();
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (auth.isAdmin) void load();
  });

  // Ordered areas so groups render in a stable, sensible order. Must match the
  // ServiceArea values the API emits (see admin.service.ts).
  const AREAS = [
    ...Object.values(DOMAINS).map((d) => d.label),
    "Système",
  ] as const;

  const grouped = $derived(
    AREAS.map((area) => ({
      area,
      items: (services ?? []).filter((s) => s.area === area),
    })).filter((g) => g.items.length > 0),
  );

  const timeFmt = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const nf = new Intl.NumberFormat("fr-FR");

  // --- page header summary ---------------------------------------------------
  // Everything below is derived from the payload the list already renders: the
  // page loads every service in one call, so a summary endpoint would only
  // re-fetch what's on screen (and risk disagreeing with it).

  /** Planned providers are excluded everywhere: they have nothing to be healthy or spend. */
  const live = $derived((services ?? []).filter((s) => !s.comingSoon));

  /** Configured and either probed-OK or unprobeable (VAPID has nothing to ping). */
  const healthy = $derived(
    live.filter((s) => s.configured && s.reachable !== false).length,
  );

  const callsToday = $derived(live.reduce((sum, s) => sum + (s.today ?? 0), 0));

  const metered = $derived(live.filter((s) => s.limit !== undefined));
  /** Providers billed by call but with no documented ceiling — the ones nothing warns about. */
  const unmetered = $derived(
    live.filter((s) => s.limit === undefined && s.today !== undefined),
  );

  const busiestQuota = $derived(
    metered.reduce((max, s) => Math.max(max, s.percentUsed ?? 0), 0),
  );

  const kpis = $derived([
    {
      value: `${healthy}/${live.length}`,
      label: m.admin_services_kpi_operational(),
    },
    { value: nf.format(callsToday), label: m.admin_services_kpi_calls_today() },
    {
      value: String(busiestQuota),
      unit: "%",
      label: m.admin_services_kpi_busiest_quota(),
      alert: busiestQuota >= 80,
    },
  ]);

  /** Calls counted against the window the provider's own quota resets on. */
  function quotaUsage(s: ServiceStatusDto): number {
    return (s.limit?.window === "month" ? s.thisMonth : s.today) ?? 0;
  }

  const meteredBars = $derived(
    [...metered]
      .sort((a, b) => (b.percentUsed ?? 0) - (a.percentUsed ?? 0))
      .map((s) => ({
        label: s.label,
        value: quotaUsage(s),
        display: `${nf.format(quotaUsage(s))} / ${nf.format(s.limit?.max ?? 0)}`,
        badge: {
          text: `${s.percentUsed ?? 0} %`,
          tone: ((s.percentUsed ?? 0) >= 80 ? "warn" : "neutral") as
            "warn" | "neutral",
        },
      })),
  );

  const unmeteredBars = $derived(
    [...unmetered]
      .sort((a, b) => (b.today ?? 0) - (a.today ?? 0))
      .map((s) => ({
        label: s.label,
        value: s.today ?? 0,
        display: `${nf.format(s.today ?? 0)} ${m.admin_period_today()}`,
        badge: { text: m.admin_services_no_limit_badge() },
      })),
  );

  type Health = { label: string; cls: string };

  /** Overall health badge for one service, combining config + probe. */
  function health(s: ServiceStatusDto): Health {
    if (s.comingSoon) {
      return {
        label: m.common_coming_soon(),
        cls: "border-border bg-surface-2 text-dim",
      };
    }
    if (!s.configured) {
      return s.required
        ? {
            label: m.admin_services_not_configured(),
            cls: "border-danger/40 bg-danger/10 text-danger",
          }
        : {
            label: m.admin_services_not_configured(),
            cls: "border-border bg-surface-2 text-dim",
          };
    }
    if (s.reachable === true) {
      return {
        label: m.admin_status_ok(),
        cls: "border-success/40 bg-success/10 text-success",
      };
    }
    if (s.reachable === false) {
      return {
        label: m.admin_services_down(),
        cls: "border-danger/40 bg-danger/10 text-danger",
      };
    }
    // Configured but not probed (no cheap ping, e.g. VAPID).
    return {
      label: m.admin_services_configured_badge(),
      cls: "border-accent/40 bg-accent/10 text-accent",
    };
  }

  /** Hairline gauge fill color once a documented quota is approached or exceeded. */
  function gaugeCls(percentUsed: number): string {
    return percentUsed >= 80 ? "bg-danger" : "bg-accent";
  }
</script>

<div class="mx-auto max-w-4xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="monitor"
    title={m.admin_services_title()}
    subtitle={m.admin_services_subtitle()}>
    {#snippet actions()}
      <button onclick={load} disabled={loading} class="btn btn-ghost shrink-0">
        {loading ? "…" : m.admin_refresh()}
      </button>
    {/snippet}
  </PageHeader>

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if loading && !services}
    <div class="space-y-3">
      {#each { length: 5 } as _, i (i)}
        <div class="card h-16 animate-pulse"></div>
      {/each}
    </div>
  {:else}
    <KpiStrip tiles={kpis} />

    <!-- Quota providers and free-running ones read very differently: one is a
         budget to watch, the other only a volume. Splitting them here keeps the
         list below free of that distinction. -->
    <div class="mb-6 grid gap-3.5 lg:grid-cols-2">
      <div class="card p-4">
        <SectionLabel label={m.admin_services_metered_section()} class="mb-3" />
        <RankBars items={meteredBars} />
      </div>
      <div class="card p-4">
        <SectionLabel
          label={m.admin_services_unmetered_section()}
          class="mb-3" />
        <RankBars items={unmeteredBars} />
      </div>
    </div>

    <div class="space-y-8">
      {#each grouped as group (group.area)}
        <section>
          <h2 class="timecode mb-2 text-xs uppercase">
            {group.area}
          </h2>
          <div class="border-border overflow-hidden rounded-xl border">
            {#each group.items as s, i (s.key)}
              {@const h = health(s)}
              <div
                class="bg-surface px-4 py-3 {i > 0
                  ? 'border-border border-t'
                  : ''}">
                <div class="flex items-center gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="text-fg font-semibold">{s.label}</span>
                      {#if s.required}
                        <span
                          class="border-border text-dim rounded-full border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase">
                          {m.admin_services_required_badge()}
                        </span>
                      {/if}
                    </div>
                    {#if s.detail}
                      <p class="text-dim mt-0.5 text-xs">
                        {s.detail}
                        {#if !s.configured && s.keyUrl}
                          · <a
                            href={s.keyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-accent decoration-accent/40 hover:decoration-accent underline underline-offset-2">
                            {m.admin_services_get_key()}
                          </a>
                        {/if}
                      </p>
                    {/if}
                  </div>
                  {#if s.latencyMs !== undefined}
                    <span class="timecode shrink-0 text-xs">
                      {s.latencyMs} ms
                    </span>
                  {/if}
                  <span
                    class="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold {h.cls}">
                    {h.label}
                  </span>
                </div>
                {#if s.today !== undefined}
                  <div class="mt-2">
                    {#if s.limit && s.percentUsed !== undefined}
                      <div class="bg-border/60 h-px w-full">
                        <div
                          class="h-px {gaugeCls(s.percentUsed)}"
                          style="width: {Math.min(s.percentUsed, 100)}%">
                        </div>
                      </div>
                      <p class="timecode mt-1.5 text-xs">
                        {nf.format(s.today)} / {nf.format(s.limit.max)}
                        {s.limit.window === "day"
                          ? m.admin_period_today()
                          : m.admin_period_this_month()}
                        ({s.percentUsed}%)
                      </p>
                    {:else}
                      <p class="timecode text-xs">
                        {nf.format(s.today)}
                        {m.admin_period_today()} · {nf.format(s.thisMonth ?? 0)}
                        {m.admin_period_this_month()}
                      </p>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>

    {#if checkedAt}
      <p class="text-dim mt-6 text-xs">
        {m.admin_services_checked_at({
          time: timeFmt.format(new Date(checkedAt)),
        })}
      </p>
    {/if}
  {/if}
</div>
