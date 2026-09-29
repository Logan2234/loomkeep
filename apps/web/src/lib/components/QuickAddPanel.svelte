<script lang="ts">
  import {
    addListItem,
    getEditableLists,
    getListMembership,
    removeListItem,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { isFeatureNew } from "$lib/feature-badges";
  import { quickAddDomain, quickAddTarget } from "$lib/quick-add";
  import { prefersReducedMotion } from "$lib/motion";
  import { scale } from "svelte/transition";
  import Banner from "./Banner.svelte";
  import Combobox from "./Combobox.svelte";
  import Icon from "./Icon.svelte";
  import NewBadge from "./NewBadge.svelte";
  import Poster from "./Poster.svelte";
  import SegmentedStatusControl from "./SegmentedStatusControl.svelte";

  let {
    href,
    link,
    shared = false,
  }: {
    /** The work page a resolved link points to. */
    href: string;
    /** The link as shared or pasted, for its site name. */
    link: string;
    /** Opened from another app's share sheet, which Back returns to. */
    shared?: boolean;
  } = $props();

  const reduced = prefersReducedMotion();
  const domain = $derived(quickAddDomain(quickAddTarget(href)!));
  const host = $derived.by(() => {
    try {
      return new URL(link).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  });

  const detailQuery = createApiQuery(() => ({
    key: domain.key,
    fetch: domain.fetch,
  }));
  const view = $derived(
    detailQuery.data ? domain.view(detailQuery.data) : null,
  );

  const listsQuery = createApiQuery(() => ({
    key: keys.lists.editable(),
    fetch: getEditableLists,
  }));
  const membershipQuery = createApiQuery(() => ({
    key: keys.lists.membership(domain.listType, view?.itemId ?? ""),
    fetch: () => getListMembership(domain.listType, view!.itemId!),
    enabled: !!view?.itemId,
  }));
  const itemIdByList = $derived<Record<string, string>>(
    membershipQuery.data ?? {},
  );
  const lists = $derived(listsQuery.data ?? []);

  let pickedStatus = $state<string | null>(null);
  let pickedLists = $state<string[] | null>(null);

  const offered = $derived(domain.statuses.map((s) => s.value));
  const status = $derived(
    pickedStatus ??
      (view?.entryId
        ? offered.includes(view.status ?? "")
          ? view.status
          : null
        : offered[0]),
  );
  const listIds = $derived(pickedLists ?? Object.keys(itemIdByList));
  const changed = $derived(
    !view?.entryId ||
      (status !== null && status !== view.status) ||
      listIds.length !== Object.keys(itemIdByList).length ||
      listIds.some((id) => !itemIdByList[id]),
  );

  interface Saved {
    entryId: string;
    added: boolean;
    listItems: { listId: string; itemId: string }[];
  }
  let saved = $state<Saved | null>(null);

  const invalidates = $derived([[domain.key[0]], ["library"], ["lists"]]);

  const saveMut = createApiMutation(() => ({
    mutate: async (): Promise<Saved> => {
      const current = view!;
      let { entryId, itemId } = current;
      const added = !entryId;
      if (!entryId || !itemId) {
        ({ entryId, itemId } = await domain.add(detailQuery.data, status!));
      } else if (status && status !== current.status) {
        await domain.setStatus(entryId, status);
      }

      const listItems: Saved["listItems"] = [];
      for (const listId of listIds) {
        if (itemIdByList[listId]) continue;
        const item = await addListItem(listId, domain.listType, itemId);
        listItems.push({ listId, itemId: item.id });
      }
      for (const [listId, listItemId] of Object.entries(itemIdByList)) {
        if (!listIds.includes(listId)) await removeListItem(listId, listItemId);
      }
      return { entryId, added, listItems };
    },
    onSuccess: (result) => (saved = result),
    invalidates,
    errorToast: true,
  }));

  // The lists it was just added to go too: undoing leaves no trace.
  const undoMut = createApiMutation(() => ({
    mutate: async (done: Saved) => {
      for (const { listId, itemId } of done.listItems)
        await removeListItem(listId, itemId);
      await domain.remove(done.entryId);
    },
    onSuccess: () => {
      saved = null;
      pickedStatus = null;
      pickedLists = null;
    },
    successToast: m.quick_add_undone(),
    invalidates,
    errorToast: true,
  }));

  const labelOf = (value: string | null) =>
    domain.statuses.find((s) => s.value === value)?.label ?? "";
  const savedLists = $derived(
    lists.filter((l) => listIds.includes(l.id)).map((l) => l.title),
  );
</script>

<!-- Buttons stack by the card's own width: narrow on the share screen, wide in search. -->
<section
  class="card @container flex flex-col gap-5 p-4 md:p-5"
  aria-live="polite">
  {#if saved}
    <div class="flex flex-col items-center gap-2 py-6 text-center">
      <span
        class="bg-success text-surface mb-1 grid h-14 w-14 place-items-center rounded-full"
        in:scale={{ start: 0.4, duration: reduced ? 0 : 350 }}>
        <Icon name="check" class="h-7 w-7" />
      </span>
      <h2 class="font-display text-xl font-bold text-balance">
        {saved.added
          ? m.quick_add_done_title({ title: view?.title ?? "" })
          : m.quick_add_saved_title()}
      </h2>
      <p class="text-dim max-w-xs text-sm">
        {savedLists.length > 0
          ? m.quick_add_done_status_lists({
              status: labelOf(status),
              lists: savedLists.join(", "),
            })
          : m.quick_add_done_status({ status: labelOf(status) })}
      </p>
      {#if shared}
        <p class="text-micro text-dim mt-2 max-w-xs">
          {m.quick_add_back_hint()}
        </p>
      {/if}
    </div>
    <div class="flex flex-col gap-2 @md:flex-row">
      <a class="btn btn-primary flex-1" {href}>{m.quick_add_open()}</a>
      {#if saved.added}
        <button
          type="button"
          class="btn btn-ghost flex-1"
          disabled={undoMut.loading}
          onclick={() => undoMut.mutate(saved!)}>
          {m.quick_add_undo()}
        </button>
      {/if}
    </div>
  {:else if detailQuery.error}
    <p class="text-danger text-sm">{detailQuery.error}</p>
    <a class="btn btn-ghost self-start" {href}>{m.quick_add_open()}</a>
  {:else if !view}
    <div class="flex animate-pulse gap-4" aria-busy="true">
      <div class="bg-surface-2 aspect-[2/3] w-22 shrink-0 rounded-lg"></div>
      <div class="flex flex-1 flex-col justify-end gap-2">
        <div class="bg-surface-2 h-5 w-3/4 rounded"></div>
        <div class="bg-surface-2 h-3 w-1/2 rounded"></div>
      </div>
    </div>
  {:else}
    <div class="flex items-end gap-4">
      <div class="w-22 shrink-0">
        <Poster
          src={view.posterUrl}
          title={view.title}
          alt=""
          caption={false}
          class="rounded-lg shadow-lg" />
      </div>
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          {#if host}
            <p class="timecode text-micro tracking-wide uppercase">
              {m.quick_add_from_link({ site: host })}
            </p>
          {/if}
          {#if isFeatureNew("quick-add")}<NewBadge />{/if}
        </div>
        <h2 class="font-display mt-1 text-2xl leading-tight font-bold">
          {view.title}
        </h2>
        <p class="timecode text-micro mt-1 tracking-wide uppercase">
          {view.meta.join(" · ")}
        </p>
      </div>
    </div>

    {#if view.entryId}
      <p
        class="bg-accent/10 text-accent rounded-lg px-3 py-2.5 text-sm font-semibold">
        {m.quick_add_tracked({
          status: domain.labels[view.status ?? ""] ?? "",
        })}{view.progress ? ` · ${view.progress}` : ""}
      </p>
    {/if}

    <div class="flex flex-col gap-1.5">
      <span class="text-dim text-xs font-semibold">{m.common_status()}</span>
      <SegmentedStatusControl
        statuses={offered}
        current={status ?? ""}
        disabled={saveMut.loading}
        meta={Object.fromEntries(
          domain.statuses.map((s) => [s.value, { label: s.label }]),
        )}
        desc={Object.fromEntries(
          domain.statuses.map((s) => [s.value, s.label]),
        )}
        activeClass={Object.fromEntries(
          offered.map((s) => [s, "bg-surface text-fg shadow-sm"]),
        )}
        onSelect={(next) => (pickedStatus = next)} />
      {#if domain.completedHint && status === "COMPLETED" && view.status !== "COMPLETED"}
        <Banner variant="info">{domain.completedHint}</Banner>
      {/if}
    </div>

    {#if lists.length > 0}
      <div class="flex flex-col items-start gap-1.5">
        <span class="text-dim text-xs font-semibold">
          {m.quick_add_lists_hint()}
        </span>
        <Combobox
          label={m.common_lists()}
          emptySelection={m.quick_add_no_list()}
          multiselect
          searchable={lists.length > 7}
          options={lists.map((l) => ({ label: l.title, value: l.id }))}
          values={listIds}
          disabled={saveMut.loading}
          onChange={(next) => (pickedLists = next)} />
      </div>
    {/if}

    <div class="flex flex-col gap-2 @md:flex-row">
      <button
        type="button"
        class="btn btn-primary flex-1"
        disabled={saveMut.loading || !changed || status === null}
        onclick={() => saveMut.mutate()}>
        {view.entryId ? m.common_save() : m.library_add()}
      </button>
      <a class="btn btn-ghost flex-1" {href}>{m.quick_add_open()}</a>
    </div>
  {/if}
</section>
