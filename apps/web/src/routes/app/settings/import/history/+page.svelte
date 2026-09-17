<script lang="ts">
  import { getImportHistory } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { keys } from "$lib/api/keys";
  import Banner from "$lib/components/Banner.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RelativeTime from "$lib/components/RelativeTime.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { IMPORTS_DEFINITION } from "$lib/constants/import-sources";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    Domain,
    ImportHistoryRunDto,
    PagedResult,
  } from "@loomkeep/shared";

  const historyQuery = createApiInfiniteQuery<
    PagedResult<ImportHistoryRunDto>,
    number,
    ImportHistoryRunDto
  >(() => ({
    key: keys.import.history(),
    fetch: getImportHistory,
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
  }));
  const runs = $derived(historyQuery.data);

  function sourceLabel(sourceId: ImportHistoryRunDto["sourceId"]): string {
    return IMPORTS_DEFINITION[sourceId]?.label ?? sourceId;
  }

  function domainLabel(domain: Domain | null): string | null {
    return domain ? DOMAINS[domain].label : null;
  }
</script>

<div class="max-w-3xl">
  <PageHeader
    icon="download"
    title={m.settings_import_history_title()}
    subtitle={m.settings_import_history_description()}
    back="/app/settings/import"
    class="mb-6" />

  {#if historyQuery.loading}
    <CardRowSkeleton count={4} />
  {:else if historyQuery.error}
    <Banner variant="error">{historyQuery.error}</Banner>
  {:else if runs.length === 0}
    <EmptyState class="px-5 py-10">
      <Icon name="download" class="text-accent mx-auto h-6 w-6" />
      <p class="mt-3 font-semibold">
        {m.settings_import_history_empty_title()}
      </p>
      <p class="text-dim mt-1 text-sm">
        {m.settings_import_history_empty_body()}
      </p>
    </EmptyState>
  {:else}
    <ul class="flex flex-col gap-2.5">
      {#each runs as run (run.id)}
        {@const succeeded = run.status === "SUCCESS"}
        {@const domain = domainLabel(run.domain)}
        <li class="card flex items-start gap-3 p-4">
          <Icon
            name={run.domain ? DOMAINS[run.domain].icon : "download"}
            class="mt-0.5 h-5 w-5 shrink-0 {succeeded
              ? 'text-accent'
              : 'text-danger'}" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="font-semibold">{sourceLabel(run.sourceId)}</span>
              {#if domain}
                <span class="text-dim text-sm">{domain}</span>
              {/if}
              {#if run.overwrite}
                <span class="text-warning text-xs font-semibold">
                  {m.settings_import_history_overwrite()}
                </span>
              {/if}
            </div>
            <p class="text-dim mt-0.5 text-sm">
              <RelativeTime iso={run.finishedAt} />
              {#if succeeded}
                <span aria-hidden="true"> · </span>
                {run.itemCount === 1
                  ? m.settings_import_history_items_one({
                      count: run.itemCount,
                    })
                  : m.settings_import_history_items_many({
                      count: run.itemCount,
                    })}
              {/if}
            </p>
            {#if run.summary}
              <p class="text-dim mt-1 text-sm">{run.summary}</p>
            {/if}
          </div>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold {succeeded
              ? 'bg-success/10 text-success'
              : 'bg-danger/10 text-danger'}">
            {succeeded
              ? m.settings_import_history_success()
              : m.common_failure()}
          </span>
        </li>
      {/each}
    </ul>

    {#if historyQuery.hasNextPage}
      <div class="mt-5 flex justify-center">
        <button
          class="btn btn-ghost"
          disabled={historyQuery.isFetchingNextPage}
          onclick={() => historyQuery.fetchNextPage()}>
          {historyQuery.isFetchingNextPage
            ? m.common_loading()
            : m.common_see_more()}
        </button>
      </div>
    {/if}
  {/if}
</div>
