<script lang="ts">
  import {
    resetHomePhoneLayout,
    saveHomePhoneLayout,
  } from "#lib/api/client.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import ConfirmationModal from "#lib/components/ConfirmationModal.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { currentHomeGate } from "#lib/home/gate.js";
  import {
    PHONE_WIDGET_TYPES,
    resolvePhoneLayout,
  } from "#lib/home/phone-layout.js";
  import { HOME_WIDGETS, isWidgetShown } from "#lib/home/widgets.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { HomePhoneWidgetDto, HomeWidgetType } from "@loomkeep/shared";
  import { flip } from "svelte/animate";
  import { prefersReducedMotion } from "#lib/motion.js";
  import WidgetConfigModal from "./WidgetConfigModal.svelte";

  // The phone home's editor (HOM-04): a list in reading order instead of the
  // desktop grid. Every change is saved at once — a phone has no room for a
  // "save" bar, and a reorder is cheap to undo by dragging back.
  const gate = $derived(currentHomeGate());
  const reduced = prefersReducedMotion();
  let draft = $state<HomePhoneWidgetDto[]>(
    $state.snapshot(resolvePhoneLayout(auth.user?.homePhoneLayout, gate)),
  );
  let announcement = $state("");
  let configuring = $state<string | null>(null);
  let confirmingReset = $state(false);

  const saveMut = createApiMutation(() => ({
    mutate: (widgets: HomePhoneWidgetDto[]) => saveHomePhoneLayout({ widgets }),
    errorToast: true,
  }));
  const resetMut = createApiMutation(() => ({
    mutate: () => resetHomePhoneLayout(),
    onSuccess: () => {
      draft = resolvePhoneLayout(null, gate);
      confirmingReset = false;
    },
    successToast: m.home_editor_reset_done(),
    errorToast: true,
  }));

  function commit(next: HomePhoneWidgetDto[]) {
    draft = next;
    saveMut.mutate($state.snapshot(next));
  }

  const title = (type: HomeWidgetType) => HOME_WIDGETS[type].title();
  const addable = $derived(
    PHONE_WIDGET_TYPES.filter(
      (type) =>
        isWidgetShown(type, gate) &&
        (HOME_WIDGETS[type].repeatable || !draft.some((w) => w.type === type)),
    ),
  );

  function add(type: HomeWidgetType) {
    const id = `${type}-${Date.now().toString(36)}`;
    commit([...draft, { id, type }]);
    announcement = m.home_editor_added({ name: title(type) });
    if (HOME_WIDGETS[type].configurable) configuring = id;
  }

  function remove(widget: HomePhoneWidgetDto) {
    commit(draft.filter((w) => w.id !== widget.id));
    announcement = m.home_editor_removed({ name: title(widget.type) });
  }

  function move(index: number, to: number) {
    if (to < 0 || to >= draft.length || to === index) return;
    const next = [...draft];
    const [widget] = next.splice(index, 1);
    next.splice(to, 0, widget);
    commit(next);
    announcement = m.home_phone_editor_moved({
      name: title(widget.type),
      position: to + 1,
    });
  }

  // Dragging by the handle: the row follows the finger and takes the place of
  // the row its middle crosses; the order is saved when it's let go.
  let dragging = $state<{ id: string; offset: number } | null>(null);
  let list = $state<HTMLElement>();
  function startDrag(event: PointerEvent, widget: HomePhoneWidgetDto) {
    if (event.button !== 0 || !list) return;
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    let base = event.clientY;
    const startIndex = draft.findIndex((w) => w.id === widget.id);
    dragging = { id: widget.id, offset: 0 };

    const onMove = (e: PointerEvent) => {
      if (!dragging || !list) return;
      dragging.offset = e.clientY - base;
      const rows = [...list.querySelectorAll<HTMLElement>("[data-row]")];
      const index = draft.findIndex((w) => w.id === widget.id);
      const self = rows[index].getBoundingClientRect();
      const middle = self.top + self.height / 2;
      const target = rows.findIndex((row, i) => {
        if (i === index) return false;
        const r = row.getBoundingClientRect();
        return middle > r.top && middle < r.bottom;
      });
      if (target === -1) return;
      const next = [...draft];
      next.splice(target, 0, ...next.splice(index, 1));
      draft = next;
      base = e.clientY;
      dragging.offset = 0;
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      dragging = null;
      const to = draft.findIndex((w) => w.id === widget.id);
      if (to !== startIndex) {
        commit(draft);
        announcement = m.home_phone_editor_moved({
          name: title(widget.type),
          position: to + 1,
        });
      }
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  function onHandleKey(event: KeyboardEvent, index: number) {
    if (event.key === "ArrowUp") move(index, index - 1);
    else if (event.key === "ArrowDown") move(index, index + 1);
    else return;
    event.preventDefault();
  }

  const configured = $derived(draft.find((w) => w.id === configuring));
</script>

<p class="text-dim mb-4 text-sm">{m.home_phone_editor_note()}</p>

<h2 class="text-dim mb-2 px-1 text-sm font-semibold">
  {m.home_phone_editor_placed()}
</h2>
<ul class="inset-card divide-border divide-y" bind:this={list}>
  {#each draft as widget, index (widget.id)}
    {@const def = HOME_WIDGETS[widget.type]}
    <li
      data-row
      class="bg-surface relative flex min-h-14 items-center gap-2 px-2 py-1.5 {dragging?.id ===
      widget.id
        ? 'z-10 rounded-xl shadow-lg'
        : ''}"
      style:transform={dragging?.id === widget.id
        ? `translateY(${dragging.offset}px)`
        : undefined}
      animate:flip={{ duration: reduced || dragging ? 0 : 200 }}>
      <button
        type="button"
        class="text-dim grid h-11 w-9 shrink-0 cursor-grab touch-none place-items-center"
        aria-label={m.home_editor_move({ name: def.title() })}
        onpointerdown={(e) => startDrag(e, widget)}
        onkeydown={(e) => onHandleKey(e, index)}>
        <Icon name="grip" class="h-5 w-5" />
      </button>
      <Icon name={def.icon} class="text-accent h-5 w-5 shrink-0" />
      <span class="min-w-0 flex-1">
        <span class="block truncate font-semibold">{def.title()}</span>
        <span class="text-dim block truncate text-sm">{def.description()}</span>
      </span>
      {#if def.configurable}
        <button
          type="button"
          class="text-dim hover:text-fg hover:bg-surface-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors"
          aria-label={m.home_editor_configure({ name: def.title() })}
          onclick={() => (configuring = widget.id)}>
          <Icon name="gear" class="h-5 w-5" />
        </button>
      {/if}
      <button
        type="button"
        class="text-dim hover:text-danger hover:bg-surface-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-40"
        aria-label={m.home_editor_remove({ name: def.title() })}
        disabled={draft.length === 1}
        onclick={() => remove(widget)}>
        <Icon name="minus" class="h-5 w-5" />
      </button>
    </li>
  {/each}
</ul>

{#if addable.length > 0}
  <h2 class="text-dim mt-6 mb-2 px-1 text-sm font-semibold">
    {m.home_phone_editor_addable()}
  </h2>
  <ul class="inset-card divide-border divide-y">
    {#each addable as type (type)}
      {@const def = HOME_WIDGETS[type]}
      <li class="flex min-h-14 items-center gap-3 py-1.5 pr-2 pl-4">
        <Icon name={def.icon} class="text-accent h-5 w-5 shrink-0" />
        <span class="min-w-0 flex-1">
          <span class="block truncate font-semibold">{def.title()}</span>
          <span class="text-dim block truncate text-sm"
            >{def.description()}</span>
        </span>
        <button
          type="button"
          class="text-accent hover:bg-surface-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors"
          aria-label={m.home_editor_add() + " : " + def.title()}
          onclick={() => add(type)}>
          <Icon name="plus" class="h-5 w-5" />
        </button>
      </li>
    {/each}
  </ul>
{/if}

{#if auth.user?.homePhoneLayout}
  <div class="mt-6 flex justify-center">
    <button
      type="button"
      class="btn btn-ghost"
      onclick={() => (confirmingReset = true)}>
      {m.home_editor_reset()}
    </button>
  </div>
{/if}

<p class="sr-only" aria-live="polite">{announcement}</p>

{#if configured}
  <WidgetConfigModal
    phone
    widget={{ ...configured, x: 0, y: 0, w: 12, h: 1 }}
    onapply={(config) =>
      commit(draft.map((w) => (w.id === configured.id ? { ...w, config } : w)))}
    onclose={() => (configuring = null)} />
{/if}

{#if confirmingReset}
  <ConfirmationModal
    title={m.home_editor_reset()}
    message={m.home_editor_reset_confirm()}
    busy={resetMut.loading}
    onConfirm={() => resetMut.mutate()}
    onCancel={() => (confirmingReset = false)} />
{/if}
