<script lang="ts">
  // "Comptes & engagement": who is on the instance and how alive they are.
  // Everything activity-related comes from refresh-token usage (see the API
  // service) — ActivityEvent only exists since P4 and would bury old accounts.
  import { getAdminNewAccountsTrend } from "$lib/api/client";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import {
    DORMANT_AFTER_DAYS,
    ProfileAccess,
    type AdminAccountsSectionDto,
    type TrendPeriod,
  } from "@loomkeep/shared";
  import CohortTable from "./CohortTable.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import StatFigure from "$lib/components/stats/StatFigure.svelte";
  import TrendPeriodCard from "./TrendPeriodCard.svelte";

  let { stats }: { stats: AdminAccountsSectionDto } = $props();

  const nf = new Intl.NumberFormat("fr-FR");

  const DELTA_LABEL: Record<TrendPeriod, string> = {
    day: m.admin_accounts_delta_today(),
    week: m.admin_accounts_delta_week(),
    month: m.admin_period_this_month(),
    year: m.admin_accounts_delta_year(),
  };

  const domainItems = $derived(
    stats.byEnabledDomainCount.map((b) => ({
      label:
        b.domains > 1
          ? m.admin_accounts_domains_many({ count: b.domains })
          : m.admin_accounts_domain_one(),
      value: b.accounts,
    })),
  );

  // Labels mirror the privacy settings page; colours are tied to the meaning,
  // not to the rank, so the reading stays stable as counts move.
  const ACCESS_LABEL: Record<ProfileAccess, string> = {
    [ProfileAccess.PUBLIC]: m.common_public(),
    [ProfileAccess.PRIVATE]: m.common_private(),
    [ProfileAccess.GHOST]: m.common_ghost(),
  };
  const ACCESS_COLOR: Record<ProfileAccess, string> = {
    [ProfileAccess.PUBLIC]: "var(--stat-media)",
    [ProfileAccess.PRIVATE]: "var(--stat-games)",
    [ProfileAccess.GHOST]: "var(--dim)",
  };
  const accessItems = $derived(
    stats.byProfileAccess.map((a) => ({
      label: ACCESS_LABEL[a.access],
      value: a.count,
      color: ACCESS_COLOR[a.access],
    })),
  );

  const healthItems = $derived([
    {
      value: stats.health.dormant,
      label: m.admin_accounts_health_dormant({ days: DORMANT_AFTER_DAYS }),
    },
    {
      value: stats.health.activeSessions,
      label: m.admin_accounts_health_sessions(),
    },
    {
      value: stats.health.emailVerified,
      label: m.admin_accounts_health_email_verified(),
    },
    { value: stats.health.withPush, label: m.admin_accounts_health_push() },
  ]);
</script>

<div class="grid gap-3.5 lg:grid-cols-2">
  <TrendPeriodCard
    title={m.admin_accounts_new_title()}
    initial={stats.newAccounts}
    load={getAdminNewAccountsTrend}
    errorMessage={m.admin_accounts_trend_error()}>
    {#snippet footer(trend)}
      <p class="timecode mt-1.5 text-xs">
        {m.admin_accounts_trend_summary({
          total: nf.format(trend.totalAccounts),
          delta: nf.format(trend.delta),
          period: DELTA_LABEL[trend.period],
        })}
      </p>
    {/snippet}
  </TrendPeriodCard>

  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">
      {m.admin_accounts_retention_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      {m.admin_accounts_retention_desc()}
    </p>
    <CohortTable cohorts={stats.cohorts} />
  </div>
</div>

<div class="mt-3.5 grid gap-3.5 lg:grid-cols-3">
  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">
      {m.admin_accounts_domains_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      {m.admin_accounts_domains_desc()}
    </p>
    <RankBars items={domainItems} initialCount={6} />
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">
      {m.admin_accounts_privacy_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      {m.admin_accounts_privacy_desc()}
    </p>
    <RankBars items={accessItems} />
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">
      {m.admin_accounts_health_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      {m.admin_accounts_health_desc()}
    </p>
    <div class="grid grid-cols-2 gap-3">
      {#each healthItems as item (item.label)}
        <StatFigure value={nf.format(item.value)} label={item.label} />
      {/each}
    </div>
  </div>
</div>
