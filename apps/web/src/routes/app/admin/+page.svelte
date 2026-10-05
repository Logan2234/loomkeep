<script lang="ts">
  import { env } from "$env/dynamic/public";
  import { adminAttentionData } from "#lib/admin-attention.js";
  import {
    getAdminBackupFiles,
    getAdminJobs,
    getAdminOverview,
    getAdminServices,
  } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import BetaBadge from "#lib/components/BetaBadge.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { VISIBLE_ADMIN_NAV_GROUPS } from "#lib/constants/admin-nav.js";
  import { adminJobLabel } from "#lib/constants/admin-presentation.js";
  import { DOCS_URL, GITHUB_REPO_URL } from "#lib/constants/external-links.js";
  import { formatNumber, formatRelative } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import { useReportsPendingCount } from "#lib/reports-pending.svelte.js";
  import type { ServiceStatusDto } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import StatsSectionError from "./stats/components/StatsSectionError.svelte";
  import AttentionLink from "./AttentionLink.svelte";

  const queryClient = useQueryClient();

  const overviewQuery = createApiQuery(() => ({
    key: keys.admin.overview(),
    fetch: getAdminOverview,
  }));
  const servicesQuery = createApiQuery(() => ({
    key: keys.admin.services(),
    fetch: getAdminServices,
  }));
  const jobsQuery = createApiQuery(() => ({
    key: keys.admin.jobs(),
    fetch: () => getAdminJobs().then((r) => r.jobs),
  }));
  const backupsQuery = createApiQuery(() => ({
    key: keys.admin.backups(),
    fetch: getAdminBackupFiles,
  }));
  const reportsPending = useReportsPendingCount();

  const overview = $derived(overviewQuery.data);
  const services = $derived(servicesQuery.data?.services ?? null);
  const jobs = $derived(jobsQuery.data);
  const backups = $derived(backupsQuery.data?.files);
  const attention = $derived(
    adminAttentionData(services, jobs, backupsQuery.data),
  );
  const loadingText = (loading: boolean) =>
    loading ? m.common_loading() : m.common_unavailable();

  const usersTotal = $derived(overview?.accounts ?? null);
  const usersDeltaWeek = $derived(overview?.newAccountsThisWeek ?? null);

  /** A service counts as degraded once it's live/required and either unconfigured or unreachable. */
  function isDegraded(s: ServiceStatusDto): boolean {
    if (s.comingSoon) return false;
    if (!s.configured) return s.required;
    return s.reachable === false;
  }
  const servicesLive = $derived(services?.filter((s) => !s.comingSoon) ?? []);
  const servicesDegraded = $derived(servicesLive.filter(isDegraded).length);

  const jobsFailedRecent = $derived(
    jobs?.filter((j) => j.runs[0]?.status === "FAILURE").length ?? null,
  );
  const jobsLastRunAt = $derived.by(() => {
    if (!jobs) return null;
    const starts = jobs
      .map((j) => j.runs[0]?.startedAt)
      .filter((d): d is string => !!d);
    return starts.length > 0 ? starts.reduce((a, b) => (a > b ? a : b)) : null;
  });

  const cacheTotal = $derived(overview?.cachedItems ?? null);

  /** Per-row metric, only shown when a cheap real number backs it — no invented data. */
  const metricByHref = $derived.by((): Record<string, string | undefined> => {
    return {
      "/app/admin/users":
        usersTotal !== null ? formatNumber(usersTotal) : undefined,
      "/app/admin/communications":
        overview !== null
          ? m.admin_push_subscribers_count({
              count: formatNumber(overview.accountsWithPush),
            })
          : undefined,
      "/app/admin/services": services
        ? `${servicesLive.length - servicesDegraded}/${servicesLive.length}`
        : undefined,
      "/app/admin/jobs": jobsLastRunAt
        ? formatRelative(jobsLastRunAt)
        : undefined,
      "/app/admin/backup":
        backups && attention.latest
          ? m.admin_backup_count_latest({
              count: attention.available.length,
              date: formatRelative(attention.latest.createdAt),
            })
          : backups
            ? m.admin_no_backups()
            : undefined,
      "/app/admin/cache":
        cacheTotal !== null
          ? m.common_item_count_many({ count: formatNumber(cacheTotal) })
          : undefined,
      "/app/admin/reports": !appConfig.socialEnabled
        ? m.common_disabled()
        : !reportsPending.available
          ? undefined
          : reportsPending.count > 0
            ? m.admin_reports_pending_count({ count: reportsPending.count })
            : m.admin_up_to_date(),
    };
  });

  const grouped = VISIBLE_ADMIN_NAV_GROUPS;
</script>

<div>
  <PageHeader
    icon="shield"
    title={m.admin_dashboard_title()}
    back="/app"
    subtitle={m.admin_dashboard_subtitle({
      name: auth.user?.displayName ?? "",
    })}>
    {#snippet actions()}
      <a
        href={`${DOCS_URL}/self-hosting/administration/`}
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-ghost shrink-0">
        <Icon name="book-open" class="h-4 w-4" />
        {m.admin_docs_link()}
      </a>
    {/snippet}
  </PageHeader>

  <!-- Each indicator links to its operational page. -->
  <div
    class="border-border bg-border mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-3 lg:grid-cols-5">
    <a
      href="/app/admin/users"
      class="bg-surface hover:bg-surface-2 flex flex-col gap-1 p-4 transition-colors">
      <span class="text-dim flex items-center gap-1.5 text-xs font-semibold">
        <span
          class="h-1.5 w-1.5 rounded-full {overview ? 'bg-success' : 'bg-dim'}"
        ></span>
        {m.common_users()}
      </span>
      <span class="font-display text-2xl font-extrabold">
        {usersTotal !== null
          ? formatNumber(usersTotal)
          : loadingText(overviewQuery.loading)}
      </span>
      <span class="text-dim text-xs">
        {usersDeltaWeek !== null
          ? m.admin_users_added_week({ count: formatNumber(usersDeltaWeek) })
          : " "}
      </span>
    </a>

    <a
      href="/app/admin/services"
      class="bg-surface hover:bg-surface-2 flex flex-col gap-1 p-4 transition-colors">
      <span class="text-dim flex items-center gap-1.5 text-xs font-semibold">
        <span
          class="h-1.5 w-1.5 rounded-full {!services
            ? 'bg-dim'
            : servicesDegraded > 0
              ? 'bg-danger'
              : 'bg-success'}"></span>
        {m.admin_services_title()}
      </span>
      <span class="font-display text-2xl font-extrabold">
        {services
          ? `${servicesLive.length - servicesDegraded}/${servicesLive.length}`
          : loadingText(servicesQuery.loading)}
      </span>
      <span
        class="text-xs {servicesDegraded > 0
          ? 'text-danger font-semibold'
          : 'text-dim'}">
        {services
          ? servicesDegraded > 0
            ? m.admin_degraded_count({ count: servicesDegraded })
            : m.admin_services_all_healthy()
          : m.common_unavailable()}
      </span>
    </a>

    <a
      href="/app/admin/jobs"
      class="bg-surface hover:bg-surface-2 flex flex-col gap-1 p-4 transition-colors">
      <span class="text-dim flex items-center gap-1.5 text-xs font-semibold">
        <span
          class="h-1.5 w-1.5 rounded-full {jobsFailedRecent === null
            ? 'bg-dim'
            : jobsFailedRecent
              ? 'bg-danger'
              : 'bg-success'}"></span>
        {m.admin_jobs_last_failure()}
      </span>
      <span class="font-display text-2xl font-extrabold">
        {jobsFailedRecent !== null
          ? formatNumber(jobsFailedRecent)
          : loadingText(jobsQuery.loading)}
      </span>
      <span
        class="text-xs {jobsFailedRecent
          ? 'text-danger font-semibold'
          : 'text-dim'}">
        {jobsLastRunAt
          ? m.admin_last_run({ date: formatRelative(jobsLastRunAt) })
          : m.common_unavailable()}
      </span>
    </a>

    <a
      href="/app/admin/reports"
      class="bg-surface hover:bg-surface-2 flex flex-col gap-1 p-4 transition-colors">
      <span class="text-dim flex items-center gap-1.5 text-xs font-semibold">
        <span
          class="h-1.5 w-1.5 rounded-full {!appConfig.socialEnabled ||
          !reportsPending.available
            ? 'bg-dim'
            : reportsPending.count > 0
              ? 'bg-danger'
              : 'bg-success'}"></span>
        {m.admin_social_reports_title()}
      </span>
      <span class="font-display text-2xl font-extrabold">
        {!appConfig.socialEnabled
          ? m.common_disabled()
          : reportsPending.available
            ? formatNumber(reportsPending.count)
            : reportsPending.error
              ? m.common_unavailable()
              : m.common_loading()}
      </span>
      <span
        class="text-xs {reportsPending.count > 0
          ? 'text-danger font-semibold'
          : 'text-dim'}">
        {!appConfig.socialEnabled
          ? m.admin_social_disabled()
          : !reportsPending.available
            ? reportsPending.error
              ? m.common_unavailable()
              : m.common_loading()
            : reportsPending.count > 0
              ? m.admin_moderation_pending()
              : m.admin_up_to_date()}
      </span>
    </a>

    <a
      href="/app/admin/backup"
      class="bg-surface hover:bg-surface-2 flex flex-col gap-1 p-4 transition-colors">
      <span class="text-dim text-xs font-semibold"
        >{m.admin_backup_title()}</span>
      <span class="font-display text-xl font-extrabold"
        >{backupsQuery.data
          ? attention.latest
            ? formatRelative(attention.latest.createdAt)
            : m.admin_no_backups()
          : loadingText(backupsQuery.loading)}</span>
      <span class="text-dim text-xs"
        >{backupsQuery.data
          ? m.admin_backup_available({ count: attention.available.length })
          : loadingText(backupsQuery.loading)}</span>
      {#if attention.anomalies}<span class="text-warning text-xs"
          >{m.admin_backup_anomalies({ count: attention.anomalies })}</span
        >{/if}
    </a>
  </div>

  {#if overviewQuery.error || servicesQuery.error || jobsQuery.error || backupsQuery.error || reportsPending.error}
    <div class="mb-8 space-y-2" aria-label={m.common_error()}>
      {#if overviewQuery.error}
        <StatsSectionError
          message={`${m.common_users()}: ${overviewQuery.error}`}
          onRetry={() =>
            void queryClient.refetchQueries({
              queryKey: keys.admin.overview(),
            })} />
      {/if}
      {#if servicesQuery.error}
        <StatsSectionError
          message={`${m.admin_services_title()}: ${servicesQuery.error}`}
          onRetry={() =>
            void queryClient.refetchQueries({
              queryKey: keys.admin.services(),
            })} />
      {/if}
      {#if jobsQuery.error}
        <StatsSectionError
          message={`${m.admin_jobs_title()}: ${jobsQuery.error}`}
          onRetry={() =>
            void queryClient.refetchQueries({ queryKey: keys.admin.jobs() })} />
      {/if}
      {#if backupsQuery.error}
        <StatsSectionError
          message={`${m.admin_backup_title()}: ${backupsQuery.error}`}
          onRetry={() =>
            void queryClient.refetchQueries({
              queryKey: keys.admin.backups(),
            })} />
      {/if}
      {#if reportsPending.error}
        <StatsSectionError
          message={`${m.admin_social_reports_title()}: ${reportsPending.error}`}
          onRetry={reportsPending.retry} />
      {/if}
    </div>
  {/if}

  <section class="card mb-8 p-5" aria-labelledby="admin-attention-title">
    <h2 id="admin-attention-title" class="font-display mb-3 text-lg font-bold">
      {m.admin_attention()}
    </h2>
    <ul class="space-y-1">
      {#each attention.degraded as service (service.key)}<li>
          <AttentionLink
            href={`/app/admin/services#service-${service.key}`}
            icon="gauge"
            title={service.label}
            detail={m.admin_services_title()}
            tone="danger" />
        </li>{/each}
      {#each attention.failed as job (job.key)}<li>
          <AttentionLink
            href={`/app/admin/jobs#job-${job.key}`}
            icon="calendar"
            title={adminJobLabel(job.key)}
            detail={m.common_failure()}
            tone="danger" />
        </li>{/each}
      {#if appConfig.socialEnabled && reportsPending.available && reportsPending.count > 0}<li>
          <AttentionLink
            href="/app/admin/reports?status=PENDING"
            icon="flag"
            title={m.admin_reports_pending_count({
              count: reportsPending.count,
            })}
            detail={m.admin_social_reports_title()}
            tone="warning" />
        </li>{/if}
      {#if backupsQuery.data && (attention.anomalies || !attention.latest)}<li>
          <AttentionLink
            href="/app/admin/backup"
            icon="database"
            title={attention.anomalies
              ? m.admin_backup_anomalies({ count: attention.anomalies })
              : m.admin_no_backups()}
            detail={m.admin_backup_title()}
            tone="warning" />
        </li>{/if}
    </ul>
    {#if overviewQuery.loading || servicesQuery.loading || jobsQuery.loading || backupsQuery.loading || (appConfig.socialEnabled && !reportsPending.available && !reportsPending.error)}<p
        class="text-dim mt-3 text-sm"
        role="status">
        {m.common_loading()}
      </p>
    {:else if !attention.degraded.length && !attention.failed.length && !(appConfig.socialEnabled && reportsPending.count > 0) && !(backupsQuery.data && (attention.anomalies || !attention.latest))}<p
        class="text-dim text-sm">
        {m.admin_attention_empty()}
      </p>{/if}
    {#if servicesQuery.error || jobsQuery.error || backupsQuery.error || (appConfig.socialEnabled && reportsPending.error)}<p
        class="text-warning mt-3 text-sm">
        {m.admin_attention_partial()}
      </p>{/if}
  </section>

  <div class="grid items-start gap-8 lg:grid-cols-2">
    {#each grouped as cat (cat.label)}
      <section>
        <h2
          class="text-dim mb-2 flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
          {cat.label}
          <span class="bg-border h-px flex-1"></span>
        </h2>
        <div class="border-border overflow-hidden rounded-xl border">
          {#each cat.items as item, i (item.href)}
            <a
              href={item.href}
              class="bg-surface hover:bg-surface-2 flex items-center gap-3 px-4 py-3 transition-colors {i >
              0
                ? 'border-border border-t'
                : ''}">
              <span
                class="bg-accent/10 text-accent grid h-9 w-9 shrink-0 place-items-center rounded-lg">
                <Icon name={item.icon} class="h-4.5 w-4.5" />
              </span>
              <div class="min-w-0 flex-1">
                <span class="text-fg flex items-center gap-2 font-semibold">
                  {item.label}
                  {#if appConfig.socialEnabled && item.href === "/app/admin/reports" && reportsPending.count > 0}
                    <span
                      class="bg-accent text-accent-fg rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold">
                      {reportsPending.count}
                    </span>
                  {:else if item.href === "/app/admin/services" && servicesDegraded > 0}
                    <span
                      class="border-danger/40 bg-danger/10 text-danger rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">
                      {m.admin_degraded_count({ count: servicesDegraded })}
                    </span>
                  {/if}
                </span>
                <p class="text-dim mt-0.5 text-sm">{item.description}</p>
              </div>
              {#if metricByHref[item.href]}
                <span
                  class="timecode hidden shrink-0 text-xs whitespace-nowrap sm:block">
                  {metricByHref[item.href]}
                </span>
              {/if}
              <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
            </a>
          {/each}
        </div>
      </section>
    {/each}
  </div>

  <p class="text-dim mt-8 flex items-center justify-center gap-2 text-xs">
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      class="btn-text font-normal {appConfig.version ? '' : 'invisible'}">
      {m.app_version({ version: appConfig.version })}
      {#if appConfig.gitSha && appConfig.gitSha !== "unknown"}
        <span class="opacity-60">({appConfig.gitSha})</span>
      {/if}
    </a>
    {#if env.PUBLIC_IS_BETA}<BetaBadge />{/if}
  </p>
</div>
