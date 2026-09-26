<script lang="ts">
  // The chips above a library's filters: one per saved view of that library,
  // applied on click. The view in use stays marked while the filters match
  // it, and offers to update it — or save a new one — once they don't.
  import {
    createSavedView,
    deleteSavedView,
    getSavedViews,
    updateSavedView,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Dropdown from "$lib/components/Dropdown.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
  import { sameFilters } from "$lib/saved-views";
  import {
    SAVED_VIEW_LIMITS,
    type SavedViewDomain,
    type SavedViewDto,
    type SavedViewFiltersDto,
    type UpdateSavedViewDto,
  } from "@loomkeep/shared";

  let {
    domain,
    current,
    defaultSort,
    activeId = $bindable(),
    onApply,
  }: {
    domain: SavedViewDomain;
    /** The library's filters as they stand. */
    current: SavedViewFiltersDto;
    defaultSort: string;
    /** The view in use, if any. */
    activeId: string | null;
    onApply: (filters: SavedViewFiltersDto) => void;
  } = $props();

  const viewsQuery = createApiQuery(() => ({
    key: keys.savedViews.all(),
    fetch: getSavedViews,
  }));
  const views = $derived(
    (viewsQuery.data ?? []).filter((view) => view.domain === domain),
  );
  const active = $derived(views.find((view) => view.id === activeId));
  const modified = $derived(
    !!active && !sameFilters(active.filters, current, defaultSort),
  );
  const pristine = $derived(sameFilters(current, {}, defaultSort));

  // A view deleted elsewhere, or a stale `view` in the address.
  $effect(() => {
    if (viewsQuery.data && activeId && !active) activeId = null;
  });

  /** The name dialog: a new view from the current filters, or a rename. */
  let naming = $state<{ view: SavedViewDto | null } | null>(null);
  let name = $state("");
  let deleting = $state<SavedViewDto | null>(null);

  const createMut = createApiMutation(() => ({
    mutate: (viewName: string) =>
      createSavedView({ name: viewName, domain, filters: current }),
    invalidates: [keys.savedViews.all()],
    successToast: m.saved_view_created(),
    onSuccess: (view) => {
      activeId = view.id;
      naming = null;
    },
  }));

  const updateMut = createApiMutation(() => ({
    mutate: (args: { id: string; body: UpdateSavedViewDto }) =>
      updateSavedView(args.id, args.body),
    invalidates: [keys.savedViews.all()],
    successToast: m.saved_view_updated(),
    errorToast: true,
    onSuccess: () => (naming = null),
  }));

  const deleteMut = createApiMutation(() => ({
    mutate: (id: string) => deleteSavedView(id),
    invalidates: [keys.savedViews.all()],
    successToast: m.saved_view_deleted(),
    errorToast: true,
    onSuccess: (_, id) => {
      if (activeId === id) activeId = null;
      deleting = null;
    },
  }));

  function toggle(view: SavedViewDto) {
    if (view.id === activeId) {
      activeId = null;
      onApply({});
    } else {
      activeId = view.id;
      onApply(view.filters);
    }
  }

  function openNaming(view: SavedViewDto | null) {
    createMut.reset();
    updateMut.reset();
    name = view?.name ?? "";
    naming = { view };
  }

  function submitName(e: SubmitEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !naming) return;
    if (naming.view) {
      updateMut.mutate({ id: naming.view.id, body: { name: trimmed } });
    } else {
      createMut.mutate(trimmed);
    }
  }

  const namingBusy = $derived(createMut.loading || updateMut.loading);
</script>

{#if views.length > 0 || !pristine}
  <div
    class="mb-4 flex flex-wrap items-center gap-2"
    role="group"
    aria-label={m.saved_views_label()}>
    {#each views as view (view.id)}
      {@const on = view.id === activeId}
      <button
        type="button"
        class="chip inline-flex items-center gap-1.5"
        class:chip-on={on}
        aria-pressed={on}
        onclick={() => toggle(view)}>
        {view.name}
        {#if on && modified}
          <span class="italic opacity-80">· {m.saved_view_modified()}</span>
        {/if}
      </button>
    {/each}

    {#if active}
      {#if modified}
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          disabled={updateMut.loading}
          onclick={() =>
            updateMut.mutate({ id: active.id, body: { filters: current } })}>
          {m.saved_view_update()}
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          onclick={() => openNaming(null)}>
          {m.saved_view_save_as_new()}
        </button>
      {/if}
      <Dropdown placement="bottom-end" role="menu" class="min-w-40">
        {#snippet trigger({ open, toggle: toggleMenu, onkeydown })}
          <button
            type="button"
            class="btn-icon"
            aria-label={m.common_more_actions()}
            aria-haspopup="menu"
            aria-expanded={open}
            {onkeydown}
            onclick={toggleMenu}>
            <Icon name="dots-horizontal" class="h-4 w-4" />
          </button>
        {/snippet}
        {#snippet children({ close })}
          <button
            role="menuitem"
            class="menu-item"
            onclick={() => {
              close();
              openNaming(active);
            }}>
            <Icon name="edit" class="h-4 w-4" />
            {m.common_rename()}
          </button>
          <button
            role="menuitem"
            class="menu-item menu-item-danger"
            onclick={() => {
              close();
              deleting = active ?? null;
            }}>
            <Icon name="trash" class="h-4 w-4" />
            {m.common_delete()}
          </button>
        {/snippet}
      </Dropdown>
    {:else if !pristine}
      <button
        type="button"
        class="btn btn-ghost btn-sm inline-flex items-center gap-1.5"
        onclick={() => openNaming(null)}>
        <Icon name="plus" class="h-4 w-4" />
        {m.saved_view_save()}
        {#if isFeatureNew("saved-views")}
          <NewBadge />
        {/if}
      </button>
    {/if}
  </div>
{/if}

{#if naming}
  <Modal
    title={naming.view ? m.saved_view_rename_title() : m.saved_view_save()}
    onclose={() => (naming = null)}>
    <form id="saved-view-name" class="space-y-3" onsubmit={submitName}>
      {#if createMut.error ?? updateMut.error}
        <Banner variant="error">{createMut.error ?? updateMut.error}</Banner>
      {/if}
      <label
        for="saved-view-name-input"
        class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
        {m.saved_view_name_label()}
      </label>
      <input
        id="saved-view-name-input"
        type="text"
        name="name"
        class="input"
        required
        maxlength={SAVED_VIEW_LIMITS.nameLength}
        placeholder={m.saved_view_name_placeholder()}
        bind:value={name} />
    </form>
    {#snippet actions()}
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={() => (naming = null)}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          form="saved-view-name"
          class="btn btn-primary"
          disabled={namingBusy || !name.trim()}>
          {m.common_save()}
        </button>
      </div>
    {/snippet}
  </Modal>
{/if}

{#if deleting}
  {@const view = deleting}
  <ConfirmationModal
    title={m.saved_view_delete_title()}
    message={m.saved_view_delete_message({ name: view.name })}
    confirmLabel={m.common_delete()}
    danger
    busy={deleteMut.loading}
    onConfirm={() => deleteMut.mutate(view.id)}
    onCancel={() => (deleting = null)} />
{/if}
