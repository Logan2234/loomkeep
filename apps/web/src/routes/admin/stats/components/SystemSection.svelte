<script lang="ts">
  // "Système": what the instance costs to run. Every figure is a live
  // snapshot — nothing here is historised. Database size / per-table
  // breakdown deliberately isn't here — see the Homepage dashboard's "DB"
  // tile (docker/homepage/services.yaml), sourced from Prometheus instead.
  import { formatBytes, formatRelative } from "$lib/format";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import { m } from "$lib/paraglide/messages.js";
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
          ? { text: m.admin_services_no_limit_badge() }
          : {
              text: m.admin_system_quota_badge({ percent: p.percentUsed }),
              tone:
                p.percentUsed >= QUOTA_WARN_PERCENT
                  ? ("warn" as const)
                  : ("neutral" as const),
            },
    })),
  );

  const opsItems = $derived([
    {
      value: nf.format(stats.ops.notificationsPending),
      label: m.admin_system_notifs_pending(),
    },
    // A count, not a live/dead ratio: nothing tracks whether an endpoint still
    // answers, so a denominator here would be invented.
    {
      value: nf.format(stats.ops.pushSubscriptions),
      label: m.admin_system_push_subscriptions(),
    },
    {
      value: nf.format(stats.ops.failedLogins24h),
      label: m.admin_system_failed_logins(),
    },
    {
      value: stats.ops.lastBackup
        ? formatRelative(stats.ops.lastBackup.createdAt)
        : m.admin_system_no_backup(),
      label: stats.ops.lastBackup
        ? m.admin_system_last_backup_with_size({
            size: formatBytes(stats.ops.lastBackup.sizeBytes),
          })
        : m.admin_system_last_backup(),
    },
  ]);
</script>

<div class="grid gap-3.5 lg:grid-cols-2">
  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">
      {m.admin_system_api_calls_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      {m.admin_system_today_label()}
    </p>
    {#if providerItems.length === 0}
      <p class="text-dim text-sm">{m.admin_system_no_calls_today()}</p>
    {:else}
      <RankBars items={providerItems} />
    {/if}
    <p class="text-dim mt-2.5 text-[11px] italic">
      {m.admin_system_quota_detail_hint()}
      <a href="/admin/services" class="link-accent not-italic"
        >{m.admin_services_title()}</a
      >.
    </p>
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">
      {m.admin_system_ops_signals_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">{m.admin_system_misc()}</p>
    <div class="grid grid-cols-2 gap-3">
      {#each opsItems as item (item.label)}
        <StatFigure value={item.value} label={item.label} />
      {/each}
    </div>
    <p class="text-dim mt-3 text-[11px] italic">
      {m.admin_system_ops_hint()}
    </p>
  </div>
</div>
