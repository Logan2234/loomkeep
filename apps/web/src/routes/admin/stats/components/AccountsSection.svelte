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
  } from "@tracklore/shared";
  import CohortTable from "./CohortTable.svelte";
  import StatFigure from "./StatFigure.svelte";
  import TrendPeriodCard from "./TrendPeriodCard.svelte";

  let { stats }: { stats: AdminAccountsSectionDto } = $props();

  const nf = new Intl.NumberFormat("fr-FR");

  const DELTA_LABEL: Record<TrendPeriod, string> = {
    day: "aujourd’hui",
    week: "cette semaine",
    month: "ce mois-ci",
    year: "cette année",
  };

  const domainItems = $derived(
    stats.byEnabledDomainCount.map((b) => ({
      label: b.domains > 1 ? `${b.domains} domaines` : "1 domaine",
      value: b.accounts,
    })),
  );

  // Labels mirror the privacy settings page; colours are tied to the meaning,
  // not to the rank, so the reading stays stable as counts move.
  const ACCESS_LABEL: Record<ProfileAccess, string> = {
    [ProfileAccess.PUBLIC]: "Public",
    [ProfileAccess.PRIVATE]: "Privé",
    [ProfileAccess.GHOST]: "Figurant",
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
      label: `Dormants > ${DORMANT_AFTER_DAYS} j`,
    },
    { value: stats.health.activeSessions, label: "Sessions actives" },
    { value: stats.health.emailVerified, label: "Email vérifié" },
    { value: stats.health.withPush, label: "Avec push" },
  ]);
</script>

<div class="grid gap-3.5 lg:grid-cols-2">
  <TrendPeriodCard
    title="Nouveaux comptes"
    initial={stats.newAccounts}
    load={getAdminNewAccountsTrend}
    errorMessage="Évolution indisponible">
    {#snippet footer(trend)}
      <p class="timecode mt-1.5 text-xs">
        total cumulé {nf.format(trend.totalAccounts)} · +{nf.format(
          trend.delta,
        )}
        {DELTA_LABEL[trend.period]}
      </p>
    {/snippet}
  </TrendPeriodCard>

  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">Rétention par cohorte</h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      % encore actif N mois après inscription (intensité = %).
    </p>
    <CohortTable cohorts={stats.cohorts} />
  </div>
</div>

<div class="mt-3.5 grid gap-3.5 lg:grid-cols-3">
  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">Domaines activés</h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      Combien de comptes activent N domaines (max 6).
    </p>
    <RankBars items={domainItems} initialCount={6} />
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">
      Confidentialité des profils
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      Public · privé · figurant.
    </p>
    <RankBars items={accessItems} />
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">Santé des comptes</h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">Engagement brut.</p>
    <div class="grid grid-cols-2 gap-3">
      {#each healthItems as item (item.label)}
        <StatFigure value={nf.format(item.value)} label={item.label} />
      {/each}
    </div>
  </div>
</div>
