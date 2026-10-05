<script lang="ts">
  import { getAdminImportDetail } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Banner from "#lib/components/Banner.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import TabPanels from "#lib/components/TabPanels.svelte";
  import Tabs from "#lib/components/Tabs.svelte";
  import { importReportLabel } from "#lib/components/import-presentation.js";
  import { IMPORTS_DEFINITION } from "#lib/constants/import-sources.js";
  import { formatDateTime, formatDurationMs } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { AdminImportDetailDto } from "@loomkeep/shared";
  let { id, onclose }: { id: string; onclose: () => void } = $props();
  const query = createApiQuery<AdminImportDetailDto>(() => ({
    key: keys.admin.importDetail(id),
    fetch: () => getAdminImportDetail(id),
    refetchInterval: (data) => (data?.status === "RUNNING" ? 5000 : false),
  }));
  const run = $derived(query.data);
  type ItemState = "selected" | "ignored" | "unresolved";
  let activeState = $state<ItemState>("selected");
  let visible = $state(100);
  const labels = {
    selected: m.admin_imports_selected,
    ignored: m.admin_imports_ignored,
    unresolved: m.admin_imports_unresolved,
  };
  const states: ItemState[] = ["selected", "ignored", "unresolved"];
  const tabs = $derived(
    states.map((value) => ({
      value,
      label: `${labels[value]()} (${run?.details?.items.filter((item) => item.state === value).length ?? 0})`,
    })),
  );
  const items = $derived(
    run?.details?.items.filter((item) => item.state === activeState) ?? [],
  );
  function selectState(next: ItemState) {
    activeState = next;
    visible = 100;
  }
</script>

<Modal title={m.admin_imports_details()} {onclose} wide>
  {#if query.error}<Banner variant="error">{query.error}</Banner>
  {:else if query.loading}<p role="status">{m.common_loading()}</p>
  {:else if run}
    <dl class="grid grid-cols-2 gap-4 text-sm">
      <div>
        <dt class="text-dim">{m.admin_imports_source()}</dt>
        <dd>
          {IMPORTS_DEFINITION[run.sourceId as keyof typeof IMPORTS_DEFINITION]
            ?.label ?? run.sourceId}
        </dd>
      </div>
      <div>
        <dt class="text-dim">{m.common_status()}</dt>
        <dd>
          {run.phase === "analyze"
            ? m.import_analyzing()
            : run.status === "RUNNING"
              ? m.admin_jobs_running()
              : run.status === "SUCCESS"
                ? m.admin_successful()
                : m.common_failure()}
        </dd>
      </div>
      <div>
        <dt class="text-dim">{m.common_account()}</dt>
        <dd class="break-words">
          {run.identifier ?? m.admin_deleted_account()}
        </dd>
      </div>
      <div>
        <dt class="text-dim">{m.admin_date_from()}</dt>
        <dd>{formatDateTime(run.startedAt)}</dd>
      </div>
      <div>
        <dt class="text-dim">{m.admin_imports_duration()}</dt>
        <dd>
          {run.finishedAt
            ? formatDurationMs(
                new Date(run.finishedAt).getTime() -
                  new Date(run.startedAt).getTime(),
              )
            : m.admin_jobs_running()}
        </dd>
      </div>
      <div>
        <dt class="text-dim">{m.admin_imports_overwrite()}</dt>
        <dd>{run.overwrite ? m.common_yes() : m.common_no()}</dd>
      </div>
    </dl>
    {#if run.error}<Banner variant="error" class="mt-4"
        ><p class="break-words whitespace-pre-wrap">{run.error}</p></Banner
      >{/if}
    {#if run.details?.report}
      <ul class="mt-4 grid grid-cols-2 gap-3">
        {#each run.details.report.tiles as tile, i (i)}<li class="card p-3">
            <strong>{tile.value}</strong>
            <p class="text-dim text-sm">{importReportLabel(tile)}</p>
          </li>{/each}
      </ul>
    {:else if run.summary}<p class="mt-4 text-sm">{run.summary}</p>{/if}
    {#if run.details}
      <p class="text-dim mt-5 text-sm">{m.admin_imports_selection_help()}</p>
      <Tabs
        class="my-3"
        {tabs}
        current={activeState}
        onSelect={selectState}
        label={m.common_status()}
        idPrefix="admin-import-detail" />
      <TabPanels current={activeState} idPrefix="admin-import-detail">
        <ul class="divide-border divide-y text-sm">
          {#each items.slice(0, visible) as item, i (i)}<li
              class="py-2 break-words">
              {item.title}
            </li>{:else}<li class="text-dim py-3">
              {m.admin_no_data()}
            </li>{/each}
        </ul>
        {#if items.length > visible}<button
            class="btn btn-ghost mt-3"
            onclick={() => (visible += 100)}>{m.common_load_more()}</button
          >{/if}
      </TabPanels>
    {:else}<p class="text-dim mt-5 text-sm">
        {run.phase === "analyze"
          ? m.import_analyzing()
          : m.admin_imports_legacy_details()}
      </p>{/if}
  {/if}
  {#snippet actions()}<button class="btn btn-ghost" onclick={onclose}
      >{m.common_close()}</button
    >{/snippet}
</Modal>
