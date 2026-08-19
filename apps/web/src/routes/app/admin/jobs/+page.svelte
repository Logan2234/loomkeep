<script lang="ts">
  import { ApiError, getAdminJobs, runAdminJob } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import StatFigure from "$lib/components/stats/StatFigure.svelte";
  import { formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import type { JobDto } from "@loomkeep/shared";

  let jobs = $state<JobDto[] | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let running = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      jobs = (await getAdminJobs()).jobs;
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : m.admin_jobs_fetch_error();
    } finally {
      loading = false;
    }
  }

  async function runJob(key: string) {
    running = key;
    error = null;
    try {
      await runAdminJob(key);
      await load();
    } catch (err) {
      error = err instanceof ApiError ? err.message : m.admin_jobs_run_error();
    } finally {
      running = null;
    }
  }

  $effect(() => {
    if (auth.isAdmin) void load();
  });

  const DAY_MONTH_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };

  function durationMs(run: JobDto["runs"][number]): number {
    return (
      new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
    );
  }

  function durationLabel(ms: number): string {
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
  }

  /**
   * Header figures for one job, derived from the run history the page already
   * holds — `GET /admin/jobs` ships the last 20 runs per job in full, so an
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

<div class="mx-auto max-w-4xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="calendar"
    title={m.admin_jobs_title()}
    subtitle={m.admin_jobs_subtitle()}>
    {#snippet actions()}
      <button onclick={load} disabled={loading} class="btn btn-ghost shrink-0">
        {loading ? "…" : m.common_refresh()}
      </button>
    {/snippet}
  </PageHeader>

  {#if error}
    <Banner variant="error" class="mb-6">{error}</Banner>
  {/if}

  {#if loading && !jobs}
    <div class="space-y-3">
      {#each { length: 2 } as _, i (i)}
        <div class="card h-40 animate-pulse"></div>
      {/each}
    </div>
  {:else if jobs}
    <div class="space-y-8">
      {#each jobs as job (job.key)}
        {@const last = job.runs[0]}
        {@const stats = summarize(job.runs)}
        <section>
          <div class="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 class="text-fg font-semibold">{job.label}</h2>
              <p class="text-dim text-xs">{job.schedule}</p>
            </div>
            <button
              onclick={() => runJob(job.key)}
              disabled={running === job.key}
              class="btn btn-primary btn-sm shrink-0">
              {running === job.key
                ? m.admin_jobs_running()
                : m.admin_jobs_run_now()}
            </button>
          </div>

          {#if stats}
            <div class="card mb-2 grid grid-cols-3 gap-3 px-4 py-3">
              <StatFigure
                value="{stats.failurePercent} %"
                label={m.admin_jobs_failure_rate()}
                alert={stats.failurePercent > 0} />
              <StatFigure
                value={durationLabel(stats.averageMs)}
                label={m.admin_jobs_avg_duration()} />
              <StatFigure
                value={stats.count}
                label={m.admin_jobs_runs_analyzed()} />
            </div>
          {/if}

          {#if last}
            <div
              class="border-border bg-surface text-dim mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
              <span
                class="rounded-full border px-2 py-0.5 font-semibold {last.status ===
                'SUCCESS'
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-danger/40 bg-danger/10 text-danger'}">
                {last.status === "SUCCESS" ? m.common_ok() : m.common_failure()}
              </span>
              <span
                >{m.admin_jobs_last_run({
                  date: formatDate(last.startedAt, DAY_MONTH_TIME_OPTIONS),
                })}</span>
              {#if last.summary}<span>· {last.summary}</span>{/if}
            </div>
          {/if}

          {#if job.runs.length === 0}
            <p
              class="border-border bg-surface text-dim rounded-lg border p-4 text-sm">
              {m.admin_jobs_no_runs()}
            </p>
          {:else}
            <details class="card group">
              <summary
                class="bg-surface-2 group-open:border-border flex cursor-pointer list-none items-center gap-2 rounded-[inherit] px-4 py-2.5 text-sm font-semibold group-open:rounded-b-none group-open:border-b [&::-webkit-details-marker]:hidden">
                <Icon
                  name="chevron-right"
                  class="text-dim h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
                {m.admin_jobs_history({ count: job.runs.length })}
              </summary>
              <div class="overflow-hidden rounded-b-[inherit]">
                {#each job.runs as run, i (run.id)}
                  <div
                    class="bg-surface flex items-center gap-3 px-4 py-2.5 text-sm {i >
                    0
                      ? 'border-border border-t'
                      : ''}">
                    <span
                      class="h-2 w-2 shrink-0 rounded-full {run.status ===
                      'SUCCESS'
                        ? 'bg-success'
                        : 'bg-danger'}"
                      aria-hidden="true"></span>
                    <span class="text-dim w-32 shrink-0 tabular-nums">
                      {formatDate(run.startedAt, DAY_MONTH_TIME_OPTIONS)}
                    </span>
                    <span class="text-fg min-w-0 flex-1 truncate">
                      {run.status === "FAILURE" ? run.error : run.summary}
                    </span>
                    <span class="text-dim shrink-0 text-xs tabular-nums">
                      {durationMs(run)} ms
                    </span>
                  </div>
                {/each}
              </div>
            </details>
          {/if}
        </section>
      {/each}
    </div>
  {/if}
</div>
