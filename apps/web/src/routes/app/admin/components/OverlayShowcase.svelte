<script lang="ts">
  import SidePanel from "$lib/components/SidePanel.svelte";
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

  let panelOpen = $state(false);
  let nestedModalOpen = $state(false);
  let modalLong = $state(false);
  let modalError = $state(false);
  let modalLoading = $state(false);
  let modalTimer: ReturnType<typeof setTimeout>;
  import { onDestroy } from "svelte";
  onDestroy(() => clearTimeout(modalTimer));
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
  <button class="btn btn-ghost" onclick={() => (panelOpen = true)}
    >SidePanel + Modal</button>
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
    {#snippet trigger({ open, toggle, onkeydown })}
      <button
        type="button"
        class="btn btn-ghost"
        {onkeydown}
        aria-haspopup="menu"
        aria-expanded={open}
        onclick={toggle}>
        {m.admin_components_open_dropdown()}
        <Icon name="chevron-down" class="h-4 w-4" />
      </button>
    {/snippet}
    {#snippet children({ close })}
      <button type="button" role="menuitem" class="menu-item" onclick={close}>
        <Icon name="edit" class="h-4 w-4" />
        {m.common_edit()}
      </button>
      <button
        type="button"
        role="menuitem"
        class="menu-item menu-item-danger"
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

  <Tooltip text={m.admin_components_tooltip_long_text()} placement="bottom">
    <button
      type="button"
      class="btn-icon-bordered"
      aria-label={m.admin_components_tooltip_long_trigger()}>
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
    <div class="mt-4 flex flex-wrap gap-2">
      <button
        class="chip"
        class:chip-on={modalLong}
        onclick={() => (modalLong = !modalLong)}>{m.common_details()}</button>
      <button
        class="chip"
        class:chip-on={modalError}
        onclick={() => (modalError = !modalError)}>{m.common_error()}</button>
      <button
        class="chip"
        class:chip-on={modalLoading}
        onclick={() => {
          clearTimeout(modalTimer);
          modalLoading = true;
          modalTimer = setTimeout(() => (modalLoading = false), 2000);
        }}>{m.common_loading()}</button>
    </div>
    {#if modalLong}<div class="mt-4 space-y-3">
        {#each { length: 18 } as _, index (index)}<p class="text-dim text-sm">
            {m.admin_components_modal_body().repeat(3)}
          </p>{/each}
      </div>{/if}
    {#if modalError}<p role="alert" class="text-danger mt-3 text-sm">
        {m.admin_components_banner_error()}
      </p>{/if}
    {#if modalLoading}<p role="status" class="text-dim mt-3">
        {m.common_loading()}
      </p>{/if}
    {#snippet actions()}
      <div class="flex justify-end">
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => (modalOpen = false)}>
          {m.common_close()}
        </button>
      </div>
    {/snippet}
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

{#if panelOpen}
  <SidePanel
    labelledby="stress-panel-title"
    onclose={() => {
      panelOpen = false;
      nestedModalOpen = false;
    }}>
    <div
      class="border-border flex items-center justify-between gap-3 border-b p-5">
      <h2 id="stress-panel-title" class="font-display text-xl font-bold">
        SidePanel
      </h2>
      <button class="btn btn-ghost" onclick={() => (panelOpen = false)}
        >{m.common_close()}</button>
    </div>
    <div class="min-h-0 flex-1 overflow-auto p-5">
      <button class="btn btn-primary" onclick={() => (nestedModalOpen = true)}
        >{m.admin_components_open_modal()}</button>
      <p class="text-dim mt-4">{m.admin_components_drawer_body().repeat(6)}</p>
    </div>
  </SidePanel>
{/if}
{#if nestedModalOpen && panelOpen}
  <Modal
    title={m.admin_components_modal_title()}
    onclose={() => (nestedModalOpen = false)}
    ><p>{m.admin_components_modal_body().repeat(4)}</p>
    {#snippet actions()}<button
        class="btn btn-primary"
        onclick={() => (nestedModalOpen = false)}>{m.common_close()}</button
      >{/snippet}</Modal>
{/if}
