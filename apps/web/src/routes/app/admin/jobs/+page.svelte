<script lang="ts">
  import { getAdminJobs, runAdminJob } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import { scrollToAdminAnchor } from "$lib/admin-anchor";
  import AdminQueryError from "../AdminQueryError.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import SectionRail from "$lib/components/SectionRail.svelte";
  import StatFigure from "$lib/components/stats/StatFigure.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import { formatDate, formatDurationMs } from "$lib/format";
  import {
    adminJobLabel,
    adminJobDescription,
    adminJobButtonState,
    adminJobSchedule,
  } from "$lib/constants/admin-presentation";
  import { m } from "$lib/paraglide/messages.js";
  import type { JobDto } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { slide } from "svelte/transition";

  const queryClient = useQueryClient();
  const reduced = prefersReducedMotion();
  let expandedJobs = $state<string[]>([]);
  let activeJob = $state<string | null>(null);

  const jobsQuery = createApiQuery(() => ({
    key: keys.admin.jobs(),
    fetch: () => getAdminJobs().then((r) => r.jobs),
    enabled: auth.isAdmin,
    refetchInterval: 5000,
  }));
  const jobs = $derived(jobsQuery.data);
  const navItems = $derived(
    (jobs ?? []).map((job) => ({
      id: job.key,
      label: adminJobLabel(job.key),
      href: `#job-${job.key}`,
      markers: [
        ...(job.runs[0]?.status === "FAILURE"
          ? [{ kind: "danger" as const, label: m.common_failure() }]
          : []),
        ...(job.overdueSince
          ? [
              {
                kind: "warning" as const,
                label: m.admin_jobs_overdue({
                  date: formatDate(job.overdueSince, {
                    ...DAY_MONTH_TIME_OPTIONS,
                    timeZone: job.timeZone ?? undefined,
                  }),
                }),
              },
            ]
          : []),
      ],
    })),
  );
  $effect(() => {
    const currentJobs = jobs ?? [];
    const observer = new IntersectionObserver(
      () => {
        const sections = currentJobs
          .map((job) => document.getElementById("job-" + job.key))
          .filter((section): section is HTMLElement => !!section);
        const section =
          sections
            .filter((section) => section.getBoundingClientRect().top <= 160)
            .at(-1) ?? sections[0];
        if (section) activeJob = section.id.slice(4);
      },
      { rootMargin: "-10% 0px -65% 0px", threshold: 0 },
    );
    for (const job of currentJobs) {
      const section = document.getElementById("job-" + job.key);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  });
  const loading = $derived(jobsQuery.loading);
  const error = $derived(jobsQuery.error);

  const runJobMut = createApiMutation(() => ({
    mutate: (key: string) => runAdminJob(key),
    invalidates: [keys.admin.jobs()],
    errorToast: true,
  }));

  function runJob(key: string) {
    runJobMut.mutate(key);
  }

  function toggleHistory(key: string) {
    expandedJobs = expandedJobs.includes(key)
      ? expandedJobs.filter((value) => value !== key)
      : [...expandedJobs, key];
  }

  const DAY_MONTH_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };

  const durationMs = (run: JobDto["runs"][number]): number =>
    new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();

  /**
   * Header figures for one job, derived from the run history the page already
   * holds — `GET /admin/jobs` ships the last 50 retained runs per job in full, so an
   * endpoint of its own would only re-fetch what's on screen. The window is
   * therefore explicitly "the runs shown here", not "since the beginning".
   * "Dernier run" isn't repeated: the banner right below already carries it,
   * with its status and summary.
   */
  function summarize(runs: JobDto["runs"]) {
    if (runs.length === 0) return null;
    const failures = runs.filter((r) => r.status === "FAILURE").length;
    const totalMs = runs.reduce((sum, r) => sum + durationMs(r), 0);
    return {
      failurePercent: Math.round((failures / runs.length) * 100),
      averageMs: Math.round(totalMs / runs.length),
      count: runs.length,
    };
  }
</script>

<div>
  <PageHeader
    icon="calendar"
    title={m.admin_jobs_title()}
    subtitle={m.admin_jobs_subtitle()}
    back="/app/admin">
    {#snippet actions()}
      <button
        onclick={() =>
          queryClient.refetchQueries({ queryKey: keys.admin.jobs() })}
        disabled={loading}
        class="btn btn-ghost shrink-0">
        {loading ? m.common_loading() : m.common_refresh()}
      </button>
    {/snippet}
  </PageHeader>

  {#if error}
    <AdminQueryError message={error} queryKey={keys.admin.jobs()} />
  {/if}

  {#if loading && !jobs}
    <div class="space-y-3">
      {#each { length: 2 } as _, i (i)}
        <div class="card h-40 animate-pulse"></div>
      {/each}
    </div>
  {:else if jobs}
    {#if jobs[0]?.timeZone}<p class="text-dim mb-4 text-xs">
        {m.admin_jobs_time_zone({ zone: jobs[0].timeZone })}
      </p>{/if}
    <div class="lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-10">
      <aside class="mb-6 min-w-0 lg:sticky lg:top-8 lg:mb-0 lg:self-start">
        <SectionRail
          label={m.admin_jobs_section_navigation()}
          items={navItems}
          activeId={activeJob ?? jobs[0]?.key ?? ""} />
      </aside>
      <div class="min-w-0 space-y-5">
        {#each jobs as job (job.key)}
          {@const last = job.runs[0]}
          {@const stats = summarize(job.runs)}
          {@const buttonState = adminJobButtonState(
            runJobMut.loading ? (runJobMut.variables ?? null) : null,
            job.key,
          )}
          {@const historyOpen = expandedJobs.includes(job.key)}
          <section
            use:scrollToAdminAnchor
            id={`job-${job.key}`}
            class="card job-card scroll-mt-6 overflow-hidden">
            <div
              class="flex flex-wrap items-start justify-between gap-4 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
              <div class="min-w-0">
                <h2 class="text-fg font-semibold">{adminJobLabel(job.key)}</h2>
                <p class="text-dim mt-1 text-sm">
                  {adminJobDescription(job.key)}
                </p>
                <p class="text-dim mt-2 text-xs">
                  {adminJobSchedule(job.key)}{#if job.nextRunAt}
                    · {m.admin_jobs_next_run({
                      date: formatDate(job.nextRunAt, {
                        ...DAY_MONTH_TIME_OPTIONS,
                        timeZone: job.timeZone ?? undefined,
                      }),
                    })}{/if}
                </p>
                {#if job.runningSince}<p
                    class="text-accent mt-2 text-xs"
                    role="status">
                    {m.admin_jobs_running_since({
                      date: formatDate(job.runningSince, {
                        ...DAY_MONTH_TIME_OPTIONS,
                        timeZone: job.timeZone ?? undefined,
                      }),
                    })}
                  </p>
                {:else if job.overdueSince}<p class="text-accent mt-2 text-xs">
                    {m.admin_jobs_overdue({
                      date: formatDate(job.overdueSince, {
                        ...DAY_MONTH_TIME_OPTIONS,
                        timeZone: job.timeZone ?? undefined,
                      }),
                    })}
                  </p>{/if}
              </div>
              <button
                onclick={() => runJob(job.key)}
                disabled={buttonState.disabled || !!job.runningSince}
                class="btn btn-primary btn-sm shrink-0">
                {buttonState.running || job.runningSince
                  ? m.admin_jobs_running()
                  : m.admin_jobs_run_now()}
              </button>
            </div>

            {#if stats}
              <div class="grid grid-cols-3 gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
                <StatFigure
                  value="{stats.failurePercent} %"
                  label={m.admin_jobs_failure_rate()} />
                <StatFigure
                  value={formatDurationMs(stats.averageMs)}
                  label={m.admin_jobs_avg_duration()} />
                <StatFigure
                  value={stats.count}
                  label={m.admin_jobs_runs_analyzed()} />
              </div>
            {/if}

            {#if last}
              <div
                class="border-border text-dim flex flex-wrap items-center gap-2 border-t px-4 py-3 text-xs sm:px-5">
                <span
                  class="rounded-full border px-2 py-0.5 font-semibold {last.status ===
                  'SUCCESS'
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-danger/40 bg-danger/10 text-danger'}">
                  {last.status === "SUCCESS"
                    ? m.common_ok()
                    : m.common_failure()}
                </span>
                <span
                  >{m.admin_jobs_last_run({
                    date: formatDate(last.startedAt, {
                      ...DAY_MONTH_TIME_OPTIONS,
                      timeZone: job.timeZone ?? undefined,
                    }),
                  })}</span>
                {#if last.summary}<span>· {last.summary}</span>{/if}
              </div>
            {/if}

            {#if job.runs.length === 0}
              <p class="border-border text-dim border-t p-4 text-sm sm:px-5">
                {m.admin_jobs_no_runs()}
              </p>
            {:else}
              <div class="border-border border-t">
                <button
                  type="button"
                  aria-expanded={historyOpen}
                  aria-controls="job-history-{job.key}"
                  onclick={() => toggleHistory(job.key)}
                  class="bg-surface-2 flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold sm:px-5">
                  <Icon
                    name="chevron-right"
                    class="text-dim h-4 w-4 shrink-0 transition-transform {historyOpen
                      ? 'rotate-90'
                      : ''}" />
                  {m.admin_jobs_history({ count: job.runs.length })}
                </button>
                {#if historyOpen}
                  <div
                    id="job-history-{job.key}"
                    transition:slide|global={{ duration: reduced ? 0 : 180 }}
                    class="overflow-hidden">
                    <div class="max-h-96 overflow-y-auto overscroll-contain">
                      <div
                        class="border-border text-dim grid grid-cols-[6rem_minmax(0,1fr)_4rem] gap-2 border-b px-4 py-2 text-xs sm:grid-cols-[9rem_minmax(0,1fr)_5rem] sm:px-5">
                        <span>{m.admin_jobs_history_date()}</span><span
                          >{m.admin_jobs_history_result()}</span
                        ><span class="text-right"
                          >{m.admin_jobs_history_duration()}</span>
                      </div>
                      {#each job.runs as run (run.id)}
                        <div
                          class="border-border grid grid-cols-[6rem_minmax(0,1fr)_4rem] items-center gap-2 border-t px-4 py-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)_5rem] sm:px-5">
                          <span class="text-dim tabular-nums">
                            {formatDate(run.startedAt, {
                              ...DAY_MONTH_TIME_OPTIONS,
                              timeZone: job.timeZone ?? undefined,
                            })}
                          </span>
                          <span class="text-fg min-w-0 break-words">
                            {run.status === "FAILURE" ? run.error : run.summary}
                          </span>
                          <span
                            class="text-dim text-right text-xs tabular-nums">
                            {formatDurationMs(durationMs(run))}
                          </span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          </section>
        {:else}<p class="card text-dim p-8 text-center">
            {m.admin_no_data()}
          </p>{/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .job-card:target {
    animation: job-focus 2.4s ease-out forwards;
  }

  @keyframes job-focus {
    0%,
    45% {
      box-shadow: 0 0 0 2px var(--accent);
    }
    100% {
      box-shadow: 0 0 0 2px transparent;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .job-card:target {
      animation-duration: 0.01ms;
    }
  }
</style>
