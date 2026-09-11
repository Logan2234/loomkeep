<script lang="ts">
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Drawer from "$lib/components/Drawer.svelte";
  import Dropdown from "$lib/components/Dropdown.svelte";
  import FocusOverlay from "$lib/components/FocusOverlay.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Lightbox from "$lib/components/Lightbox.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";

  let modalOpen = $state(false);
  let confirmationOpen = $state(false);
  let drawerOpen = $state(false);
  let focusOpen = $state(false);
  let lightboxOpen = $state(false);

  const LIGHTBOX_IMAGE =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='1350' viewBox='0 0 900 1350'%3E%3Crect width='900' height='1350' fill='%2315171c'/%3E%3Ccircle cx='450' cy='510' r='190' fill='%23f5b841' opacity='.9'/%3E%3Cpath d='M0 1030 900 770v580H0Z' fill='%232a2e38'/%3E%3C/svg%3E";

  function confirmExample() {
    confirmationOpen = false;
    toast.success(m.admin_components_toast_success());
  }
</script>

<div class="flex flex-wrap items-center gap-3">
  <button
    type="button"
    class="btn btn-primary"
    onclick={() => (modalOpen = true)}>
    {m.admin_components_open_modal()}
  </button>

  <button
    type="button"
    class="btn btn-danger"
    onclick={() => (confirmationOpen = true)}>
    {m.admin_components_open_confirmation()}
  </button>

  <button
    type="button"
    class="btn btn-ghost"
    onclick={() => (drawerOpen = true)}>
    {m.admin_components_open_drawer()}
  </button>

  <button
    type="button"
    class="btn btn-ghost"
    onclick={() => (focusOpen = true)}>
    {m.admin_components_open_focus_overlay()}
  </button>

  <button
    type="button"
    class="btn btn-ghost"
    onclick={() => (lightboxOpen = true)}>
    {m.admin_components_open_lightbox()}
  </button>

  <Dropdown placement="bottom-start" class="w-52">
    {#snippet trigger({ open, toggle })}
      <button
        type="button"
        class="btn btn-ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        onclick={toggle}>
        {m.admin_components_open_dropdown()}
        <Icon name="chevron-down" class="h-4 w-4" />
      </button>
    {/snippet}
    {#snippet children({ close })}
      <button
        type="button"
        role="menuitem"
        class="hover:bg-surface-2 flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
        onclick={close}>
        <Icon name="edit" class="h-4 w-4" />
        {m.common_edit()}
      </button>
      <button
        type="button"
        role="menuitem"
        class="text-danger hover:bg-danger/10 flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
        onclick={close}>
        <Icon name="trash" class="h-4 w-4" />
        {m.common_delete()}
      </button>
    {/snippet}
  </Dropdown>

  <Tooltip text={m.admin_components_tooltip_text()}>
    <button
      type="button"
      class="btn-icon-bordered"
      aria-label={m.admin_components_tooltip_trigger()}>
      <Icon name="question" class="h-4 w-4" />
    </button>
  </Tooltip>
</div>

<div
  class="border-border mt-4 flex flex-wrap gap-2 border-t border-dashed pt-4">
  <button
    type="button"
    class="btn btn-ghost btn-sm"
    onclick={() => toast.show(m.admin_components_toast_info())}>
    {m.admin_components_toast_info_action()}
  </button>
  <button
    type="button"
    class="btn btn-ghost btn-sm"
    onclick={() => toast.success(m.admin_components_toast_success())}>
    {m.admin_components_toast_success_action()}
  </button>
  <button
    type="button"
    class="btn btn-ghost btn-sm"
    onclick={() => toast.error(m.admin_components_toast_error())}>
    {m.admin_components_toast_error_action()}
  </button>
</div>

{#if modalOpen}
  <Modal
    title={m.admin_components_modal_title()}
    onclose={() => (modalOpen = false)}>
    <p class="text-dim text-sm">{m.admin_components_modal_body()}</p>
    <div class="mt-5 flex justify-end">
      <button
        type="button"
        class="btn btn-primary"
        onclick={() => (modalOpen = false)}>
        {m.common_close()}
      </button>
    </div>
  </Modal>
{/if}

{#if confirmationOpen}
  <ConfirmationModal
    title={m.admin_components_confirmation_title()}
    message={m.admin_components_confirmation_body()}
    confirmLabel={m.common_delete()}
    danger
    onConfirm={confirmExample}
    onCancel={() => (confirmationOpen = false)} />
{/if}

{#if drawerOpen}
  <Drawer
    onclose={() => (drawerOpen = false)}
    labelledby="component-drawer-title">
    <div class="bg-surface rounded-t-xl p-5">
      <h2 id="component-drawer-title" class="font-display text-lg font-bold">
        {m.admin_components_drawer_title()}
      </h2>
      <p class="text-dim mt-2 text-sm">{m.admin_components_drawer_body()}</p>
      <button
        type="button"
        class="btn btn-primary mt-5"
        onclick={() => (drawerOpen = false)}>
        {m.common_close()}
      </button>
    </div>
  </Drawer>
{/if}

{#if focusOpen}
  <FocusOverlay
    onclose={() => (focusOpen = false)}
    content={focusContent}
    menu={focusMenu} />
{/if}

{#if lightboxOpen}
  <Lightbox
    images={[{ src: LIGHTBOX_IMAGE, alt: m.admin_components_lightbox_alt() }]}
    onClose={() => (lightboxOpen = false)} />
{/if}

{#snippet focusContent()}
  <div class="card w-72 p-5">
    <p class="font-display text-lg font-bold">
      {m.admin_components_focus_overlay_title()}
    </p>
    <p class="text-dim mt-2 text-sm">
      {m.admin_components_focus_overlay_body()}
    </p>
  </div>
{/snippet}

{#snippet focusMenu()}
  <button
    type="button"
    class="btn btn-primary"
    onclick={() => (focusOpen = false)}>
    {m.common_close()}
  </button>
{/snippet}
