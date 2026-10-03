<script lang="ts">
  import { ApiError } from "$lib/api/core";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { getModerationTransparency } from "$lib/api/transparency";
  import {
    MODERATION_LEGAL_BASIS_LABELS,
    REPORT_CATEGORY_LABELS,
  } from "$lib/constants/report-labels";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages";
  import type { ModerationMeasure } from "@loomkeep/shared";
  import { cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";

  const MEASURE_LABELS: Record<ModerationMeasure, string> = {
    COMMENT_REMOVED: m.transparency_measure_comment(),
    REVIEW_REMOVED: m.transparency_measure_review(),
    LIST_REMOVED: m.transparency_measure_list_removed(),
    LIST_EDITED: m.transparency_measure_list_edited(),
    AVATAR_REMOVED: m.transparency_measure_avatar(),
    BIO_CLEARED: m.transparency_measure_bio(),
    DISPLAY_NAME_CHANGED: m.transparency_measure_display_name(),
    ACCOUNT_SUSPENDED: m.transparency_measure_suspended(),
    ACCOUNT_DELETED: m.transparency_measure_account(),
  };

  let year = $state<number | undefined>();
  // The API 404s when social is off: nothing to moderate on this instance.
  let unavailable = $state(false);

  const query = createApiQuery(() => ({
    key: keys.transparency(year),
    fetch: () => getModerationTransparency(year),
    keepPreviousData: true,
    retry: 0,
    onError: (err) => {
      unavailable = err instanceof ApiError && err.status === 404;
    },
  }));
  const data = $derived(query.data);

  // Svelte transitions rather than CSS animations: in dev, SvelteKit swaps its
  // SSR-inlined stylesheet for Vite's after hydration, which restarts every
  // CSS animation already on screen. Only the data-driven blocks animate —
  // the header is server-rendered and already visible before any script runs.
  const reduced = prefersReducedMotion();
  const enter = (order: number) => ({
    y: 10,
    duration: reduced ? 0 : 450,
    delay: reduced ? 0 : order * 80,
    easing: cubicOut,
  });

  function formatDuration(hours: number): string {
    if (hours < 1) return m.transparency_duration_under_hour();
    if (hours < 48)
      return m.transparency_duration_hours({ count: Math.round(hours) });
    return m.transparency_duration_days({ count: Math.round(hours / 24) });
  }
</script>

<svelte:head>
  <title>{m.transparency_page_title()} - Loomkeep</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-5 py-10 md:py-16">
  <header class="border-border mb-10 border-b pb-8 md:mb-14">
    <p class="timecode mb-4 text-xs tracking-[0.16em] uppercase">
      {m.transparency_eyebrow()}
    </p>
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
      {m.transparency_page_title()}
    </h1>
    <p class="text-dim mt-4 max-w-[62ch]">
      {m.transparency_lead()}
    </p>
    {#if data && data.years.length > 1}
      <div
        class="mt-5 flex flex-wrap gap-1.5"
        in:fly|global={enter(0)}
        role="group"
        aria-label={m.common_year()}>
        {#each data.years as y (y)}
          <button
            type="button"
            class="rounded-md border px-3 py-1.5 font-mono text-sm font-bold transition-colors {y ===
            data.year
              ? 'border-accent bg-accent text-accent-fg'
              : 'border-border text-dim hover:text-fg'}"
            aria-pressed={y === data.year}
            onclick={() => (year = y)}>{y}</button>
        {/each}
      </div>
    {/if}
  </header>

  <article class="legal-document">
    {#if unavailable}
      <p class="empty" in:fly|global={enter(0)}>
        {m.transparency_unavailable()}
      </p>
    {:else if query.error}
      <p class="empty" in:fly|global={enter(0)}>{query.error}</p>
    {:else if data}
      {#key data.year}
        {#if data.reports.total === 0 && data.measures.total === 0}
          <div class="empty" in:fly|global={enter(0)}>
            <strong class="font-display text-fg mb-1 block text-lg">
              {m.transparency_empty_title({ year: data.year })}
            </strong>
            {m.transparency_empty_body()}
          </div>
        {:else}
          <section in:fly|global={enter(0)}>
            <h2>{m.transparency_reports_heading()}</h2>
            <p>
              {data.reports.total === 1
                ? m.transparency_reports_total_one({
                    count: data.reports.total,
                    year: data.year,
                  })
                : m.transparency_reports_total_many({
                    count: data.reports.total,
                    year: data.year,
                  })}
              {#if data.reports.medianHandlingHours !== null}
                {m.transparency_median({
                  duration: formatDuration(data.reports.medianHandlingHours),
                })}
              {/if}
            </p>
            <div class="legal-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{m.transparency_col_outcome()}</th>
                    <th class="num">{m.common_count()}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{m.transparency_outcome_with_measure()}</td>
                    <td class="num">{data.reports.withMeasure}</td>
                  </tr>
                  <tr>
                    <td>{m.transparency_outcome_without_measure()}</td>
                    <td class="num">{data.reports.closedWithoutMeasure}</td>
                  </tr>
                  <tr>
                    <td>{m.transparency_outcome_pending()}</td>
                    <td class="num">{data.reports.pending}</td>
                  </tr>
                  <tr class="total">
                    <td>{m.transparency_total()}</td>
                    <td class="num">{data.reports.total}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {#if data.reports.byCategory.length > 0}
              <div class="legal-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{m.transparency_col_category()}</th>
                      <th class="num">{m.common_count()}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each data.reports.byCategory as row (row.category)}
                      <tr>
                        <td>{REPORT_CATEGORY_LABELS[row.category]}</td>
                        <td class="num">{row.count}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </section>

          <section in:fly|global={enter(1)}>
            <h2>{m.transparency_measures_heading()}</h2>
            <p>
              {data.measures.total === 1
                ? m.transparency_measures_total_one({
                    count: data.measures.total,
                    year: data.year,
                  })
                : m.transparency_measures_total_many({
                    count: data.measures.total,
                    year: data.year,
                  })}
              {#if data.measures.withoutReport > 0}
                {m.transparency_measures_without_report({
                  count: data.measures.withoutReport,
                })}
              {/if}
            </p>
            <div class="legal-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{m.transparency_col_measure()}</th>
                    <th class="num">{m.common_count()}</th>
                  </tr>
                </thead>
                <tbody>
                  {#each data.measures.byMeasure as row (row.measure)}
                    <tr>
                      <td>{MEASURE_LABELS[row.measure]}</td>
                      <td class="num">{row.count}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            <div class="legal-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{m.transparency_col_basis()}</th>
                    <th class="num">{m.common_count()}</th>
                  </tr>
                </thead>
                <tbody>
                  {#each data.measures.byLegalBasis as row (row.legalBasis)}
                    <tr>
                      <td>{MODERATION_LEGAL_BASIS_LABELS[row.legalBasis]}</td>
                      <td class="num">{row.count}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </section>

          <section in:fly|global={enter(2)}>
            <h2>{m.transparency_automated_heading()}</h2>
            <p><strong>0.</strong> {m.transparency_automated_body()}</p>
          </section>
        {/if}
      {/key}

      <p class="text-dim mt-10 text-sm" in:fly|global={enter(3)}>
        {m.transparency_appeal_prefix()}
        <a href="mailto:contact@loomkeep.app" class="link-accent"
          >contact@loomkeep.app</a
        >{m.transparency_appeal_middle()}
        <a href="/legal/terms-of-service#moderation" class="link-accent"
          >{m.transparency_appeal_terms_link()}</a
        >.
      </p>
    {/if}
  </article>
</main>

<style>
  .empty {
    border: 1px dashed var(--color-border);
    border-radius: 0.75rem;
    padding: 1.75rem 1.25rem;
    text-align: center;
    color: var(--color-dim);
  }

  .num {
    text-align: right;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--color-fg);
    white-space: nowrap;
  }

  .total td {
    color: var(--color-fg);
    font-weight: 700;
  }
</style>
