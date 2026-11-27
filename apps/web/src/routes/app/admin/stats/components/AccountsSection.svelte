<script lang="ts">
  // "Comptes & engagement": who is on the instance and how alive they are.
  // Everything activity-related comes from refresh-token usage (see the API
  // service) — ActivityEvent only exists since P4 and would bury old accounts.
  import { getAdminNewAccountsTrend } from "#lib/api/client.js";
  import HistogramBars from "#lib/components/stats/HistogramBars.svelte";
  import RankBars from "#lib/components/stats/RankBars.svelte";
  import StatFigure from "#lib/components/stats/StatFigure.svelte";
  import { formatNumber, formatPercent, formatLanguage } from "#lib/format.js";
  import { ACQUISITION_SOURCE_LABELS } from "#lib/constants/acquisition-sources.js";
  import { DELETION_REASON_LABELS } from "#lib/constants/deletion-reasons.js";
  import { m } from "#lib/paraglide/messages.js";
  import { ProfileAccess } from "@loomkeep/shared/enums";
  import {
    DORMANT_AFTER_DAYS,
    type AdminAccountsSectionDto,
    type TrendPeriod,
  } from "@loomkeep/shared/contracts";
  import CohortTable from "./CohortTable.svelte";
  import { enabledDomainsLabel } from "./enabled-domains-label";
  import TrendPeriodCard from "./TrendPeriodCard.svelte";

  let { stats }: { stats: AdminAccountsSectionDto } = $props();

  const DELTA_LABEL: Record<TrendPeriod, string> = {
    day: m.admin_accounts_delta_today(),
    week: m.admin_accounts_delta_week(),
    month: m.admin_period_this_month(),
    year: m.admin_accounts_delta_year(),
  };

  const domainItems = $derived(
    stats.byEnabledDomainCount.map((b) => ({
      label: enabledDomainsLabel(b.domains),
      value: b.accounts,
    })),
  );

  // Labels mirror the privacy settings page; colours are tied to the meaning,
  // not to the rank, so the reading stays stable as counts move.
  const ACCESS_LABEL: Record<ProfileAccess, string> = {
    [ProfileAccess.PUBLIC]: m.common_public(),
    [ProfileAccess.PRIVATE]: m.common_private(),
    [ProfileAccess.GHOST]: m.profile_ghost(),
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
    {
      value: stats.health.withNewsletter,
      label: m.admin_accounts_health_newsletter(),
    },
    {
      value: stats.health.withEpisodeEmail,
      label: m.admin_accounts_health_episode_email(),
    },
  ]);

  const ageBars = $derived(
    stats.age.distribution.map((b) => ({ label: b.label, value: b.count })),
  );

  const localeItems = $derived(
    stats.byLocale.map((l) => ({
      label: formatLanguage(l.locale),
      value: l.count,
    })),
  );

  const departureItems = $derived(
    stats.departureReasons.map((r) => ({
      label: DELETION_REASON_LABELS[r.reason](),
      value: r.count,
    })),
  );
  const departureAnswers = $derived(
    stats.departureReasons.reduce((sum, r) => sum + r.count, 0),
  );

  const acquisitionItems = $derived(
    stats.acquisition.bySource.map((s) => ({
      label: ACQUISITION_SOURCE_LABELS[s.source](),
      value: s.count,
    })),
  );
  const acquisitionAnswers = $derived(
    stats.acquisition.bySource.reduce((sum, s) => sum + s.count, 0),
  );
</script>

<div class="grid gap-3.5 lg:grid-cols-2">
  <TrendPeriodCard
    title={m.admin_accounts_new_title()}
    initial={stats.newAccounts}
    load={getAdminNewAccountsTrend}>
    {#snippet footer(trend)}
      <p class="timecode mt-1.5 text-xs">
        {m.admin_accounts_trend_summary({
          total: formatNumber(trend.totalAccounts),
          delta: formatNumber(trend.delta),
          period: DELTA_LABEL[trend.period],
        })}
      </p>
    {/snippet}
  </TrendPeriodCard>

  <div class="card p-4">
    <h3 class="font-display text-[0.9375rem] font-bold">
      {m.admin_accounts_retention_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-xs">
      {m.admin_accounts_retention_desc()}
    </p>
    <CohortTable cohorts={stats.cohorts} />
  </div>
</div>

<div class="mt-3.5 grid gap-3.5 lg:grid-cols-3">
  <div class="card p-4">
    <h3 class="font-display text-[0.9375rem] font-bold">
      {m.admin_accounts_domains_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-xs">
      {m.admin_accounts_domains_desc()}
    </p>
    <RankBars items={domainItems} initialCount={6} />
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[0.9375rem] font-bold">
      {m.admin_accounts_privacy_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-xs">
      {m.admin_accounts_privacy_desc()}
    </p>
    <RankBars items={accessItems} />
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[0.9375rem] font-bold">
      {m.admin_accounts_health_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-xs">
      {m.admin_accounts_health_desc()}
    </p>
    <div class="grid grid-cols-2 gap-3">
      {#each healthItems as item (item.label)}
        <StatFigure value={formatNumber(item.value)} label={item.label} />
      {/each}
    </div>
  </div>
</div>

<div class="mt-3.5 grid gap-3.5 lg:grid-cols-2">
  <div class="card p-4">
    <h3 class="font-display text-[0.9375rem] font-bold">
      {m.admin_accounts_age_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-xs">
      {m.admin_accounts_age_desc()}
    </p>
    <HistogramBars bars={ageBars} />
    <div class="border-border mt-3.5 grid grid-cols-2 gap-3 border-t pt-3.5">
      <StatFigure
        value={formatPercent(stats.age.birthDateSetPercent)}
        label={m.admin_accounts_age_birthdate_percent()} />
      <StatFigure
        value={formatPercent(stats.age.adultContentPercent)}
        label={m.admin_accounts_age_adult_percent()} />
    </div>
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[0.9375rem] font-bold">
      {m.admin_accounts_locale_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-xs">
      {m.admin_accounts_locale_desc()}
    </p>
    <RankBars items={localeItems} />
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[0.9375rem] font-bold">
      {m.admin_accounts_departures_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-xs">
      {m.admin_accounts_departures_desc({
        answers: formatNumber(departureAnswers),
        departures: formatNumber(stats.departures),
      })}
    </p>
    {#if departureItems.length}
      <RankBars items={departureItems} />
    {:else}
      <p class="text-dim text-sm">{m.admin_accounts_departures_empty()}</p>
    {/if}
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[0.9375rem] font-bold">
      {m.admin_accounts_acquisition_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-xs">
      {m.admin_accounts_acquisition_desc({
        answers: formatNumber(acquisitionAnswers),
      })}
    </p>
    {#if acquisitionItems.length}
      <RankBars items={acquisitionItems} initialCount={6} />
    {:else}
      <p class="text-dim text-sm">{m.admin_accounts_acquisition_empty()}</p>
    {/if}
    {#if stats.acquisition.recentOther.length}
      <h4 class="mt-4 mb-1.5 text-xs font-semibold">
        {m.admin_accounts_acquisition_other_title()}
      </h4>
      <ul class="text-dim flex flex-col gap-1.5 text-sm">
        {#each stats.acquisition.recentOther as text, i (i)}
          <li class="border-border border-l-2 pl-2 break-words">{text}</li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
