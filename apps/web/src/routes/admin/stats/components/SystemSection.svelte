<script lang="ts">
  // "Système": what the instance costs to run. Every figure is a live
  // snapshot — nothing here is historised. Database size / per-table
  // breakdown deliberately isn't here — see the Homepage dashboard's "DB"
  // tile (docker/homepage/services.yaml), sourced from Prometheus instead.
  import { formatBytes, formatRelative } from "$lib/format";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import type { AdminSystemSectionDto } from "@loomkeep/shared";
  import StatFigure from "$lib/components/stats/StatFigure.svelte";

  let { stats }: { stats: AdminSystemSectionDto } = $props();

  const nf = new Intl.NumberFormat("fr-FR");

  // A provider is flagged once it has burnt 80 % of its documented daily
  // quota — early enough to react before the day's calls start failing.
  const QUOTA_WARN_PERCENT = 80;

  const providerItems = $derived(
    stats.providerCalls.map((p) => ({
      label: p.provider,
      value: p.calls,
      display: nf.format(p.calls),
      badge:
        p.percentUsed === null
          ? { text: "sans limite" }
          : {
              text: `quota ${p.percentUsed} %`,
              tone:
                p.percentUsed >= QUOTA_WARN_PERCENT
                  ? ("warn" as const)
                  : ("neutral" as const),
            },
    })),
  );

  const opsItems = $derived([
    {
      value:
        stats.ops.notificationReadPercent === null
          ? "—"
          : `${stats.ops.notificationReadPercent} %`,
      label: "Notifs lues",
    },
    // A count, not a live/dead ratio: nothing tracks whether an endpoint still
    // answers, so a denominator here would be invented.
    {
      value: nf.format(stats.ops.pushSubscriptions),
      label: "Abonnements push",
    },
    {
      value: nf.format(stats.ops.failedLogins24h),
      label: "Échecs login · 24 h",
    },
    {
      value: stats.ops.lastBackup
        ? formatRelative(stats.ops.lastBackup.createdAt)
        : "aucune",
      label: stats.ops.lastBackup
        ? `Dernière sauvegarde · ${formatBytes(stats.ops.lastBackup.sizeBytes)}`
        : "Dernière sauvegarde",
    },
  ]);
</script>

<div class="grid gap-3.5 lg:grid-cols-2">
  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">Appels API / provider</h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">Aujourd’hui.</p>
    {#if providerItems.length === 0}
      <p class="text-dim text-sm">Aucun appel externe aujourd’hui.</p>
    {:else}
      <RankBars items={providerItems} />
    {/if}
    <p class="text-dim mt-2.5 text-[11px] italic">
      Détail quotas → page
      <a href="/admin/services" class="link-accent not-italic">Services</a>.
    </p>
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">Signaux d’exploitation</h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">Divers.</p>
    <div class="grid grid-cols-2 gap-3">
      {#each opsItems as item (item.label)}
        <StatFigure value={item.value} label={item.label} />
      {/each}
    </div>
    <p class="text-dim mt-3 text-[11px] italic">
      Jobs, imports, sécurité, backups → leurs pages dédiées.
    </p>
  </div>
</div>
