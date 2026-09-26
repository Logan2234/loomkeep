<script lang="ts">
  // The home page editor: the same widgets, with their data, on the same
  // grid — dragged by their grip, resized by their corner, removed, added
  // from the catalog, set up when their kind has settings. Nothing reaches
  // the page until "Enregistrer".
  //
  // On a screen too narrow for the page's own grid, the widgets become plain
  // tiles on a scaled-down plan of it: the page stacks them there anyway, so
  // their real content at that width would say nothing about the desktop.
  import { beforeNavigate } from "$app/navigation";
  import { resetHomeLayout, saveHomeLayout } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { auth } from "$lib/auth.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { bottomRow, compact, moveItem, resizeItem } from "$lib/home/grid";
  import { currentHomeGate } from "$lib/home/gate";
  import { hiddenWidgets, resolveHomeLayout } from "$lib/home/layout";
  import { DEFAULT_QUICK_LINKS } from "$lib/home/quick-links";
  import {
    HOME_GAP,
    HOME_GRID_MIN_WIDTH,
    HOME_ROW_HEIGHT,
    HOME_WIDGETS,
    isDivider,
  } from "$lib/home/widgets";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import {
    HOME_GRID_COLUMNS as COLUMNS,
    HOME_LAYOUT_LIMITS,
    type HomeWidgetConfigDto,
    type HomeWidgetDto,
    type HomeWidgetType,
  } from "@loomkeep/shared";
  import { tick, untrack } from "svelte";
  import { fade, scale } from "svelte/transition";
  import HomeWidget from "./HomeWidget.svelte";
  import WidgetCatalogModal from "./WidgetCatalogModal.svelte";
  import WidgetConfigModal from "./WidgetConfigModal.svelte";

  const reduced = prefersReducedMotion();
  const gate = $derived(currentHomeGate());

  const clone = (widgets: HomeWidgetDto[]): HomeWidgetDto[] =>
    JSON.parse(JSON.stringify(widgets));
  const current = () => resolveHomeLayout(auth.user?.homeLayout, gate);

  // What the page shows now, and the edited copy of it.
  let saved = $state<HomeWidgetDto[]>(untrack(current));
  let draft = $state<HomeWidgetDto[]>(untrack(() => clone(saved)));
  const dirty = $derived(JSON.stringify(draft) !== JSON.stringify(saved));
  const usingDefault = $derived(!auth.user?.homeLayout && !dirty);
  const full = $derived(draft.length >= HOME_LAYOUT_LIMITS.widgets);
  // Dividers only arrange the others: a page needs one real widget to save.
  const hasContent = $derived(draft.some((w) => !isDivider(w.type)));
  const placedTypes = $derived(new Set(draft.map((w) => w.type)));

  // Geometry. The plan keeps the page's proportions but not its sizes.
  let width = $state(0);
  const plan = $derived(width < HOME_GRID_MIN_WIDTH);
  const gap = $derived(plan ? 6 : HOME_GAP);
  const rowHeight = $derived(plan ? 28 : HOME_ROW_HEIGHT);
  const column = $derived((width - (COLUMNS - 1) * gap) / COLUMNS);
  const left = (x: number) => x * (column + gap);
  const top = (y: number) => y * (rowHeight + gap);
  const spanX = (w: number) => w * column + (w - 1) * gap;
  const spanY = (h: number) => Math.max(0, h * rowHeight + (h - 1) * gap);
  // No spare rows under the last widget: gravity lifts anything dropped
  // below everything back up anyway, and an empty band of dots read as a
  // missing widget.
  const canvasRows = $derived(bottomRow(draft));

  // A drag in progress. Positions are replayed from `start` on every pointer
  // move, so dragging back to where it began restores the layout exactly.
  interface Interaction {
    kind: "move" | "resize";
    id: string;
    start: HomeWidgetDto[];
    grabX: number;
    grabY: number;
    fromX: number;
    fromY: number;
    fromWidth: number;
    fromHeight: number;
  }
  let active = $state<Interaction | null>(null);
  let pointer = $state({ x: 0, y: 0 });
  let canvas = $state<HTMLDivElement>();
  let lastClient = { x: 0, y: 0 };
  let scrollFrame = 0;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  function canvasPoint(clientX: number, clientY: number) {
    const rect = canvas!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function setDraft(next: HomeWidgetDto[]) {
    if (JSON.stringify(next) !== JSON.stringify(draft)) draft = next;
  }

  function begin(
    kind: Interaction["kind"],
    widget: HomeWidgetDto,
    event: PointerEvent,
  ) {
    if (event.button !== 0 || !canvas) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    lastClient = { x: event.clientX, y: event.clientY };
    const point = canvasPoint(event.clientX, event.clientY);
    pointer = point;
    active = {
      kind,
      id: widget.id,
      start: clone(draft),
      grabX: point.x - left(widget.x),
      grabY: point.y - top(widget.y),
      fromX: point.x,
      fromY: point.y,
      fromWidth: spanX(widget.w),
      fromHeight: spanY(widget.h),
    };
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  function follow(point: { x: number; y: number }) {
    const drag = active;
    if (!drag) return;
    pointer = point;
    const widget = drag.start.find((w) => w.id === drag.id)!;
    if (drag.kind === "move") {
      setDraft(
        moveItem(
          drag.start,
          drag.id,
          Math.round((point.x - drag.grabX) / (column + gap)),
          Math.round((point.y - drag.grabY) / (rowHeight + gap)),
          COLUMNS,
        ),
      );
    } else {
      const { min, max } = HOME_WIDGETS[widget.type];
      const w = Math.round(
        (drag.fromWidth + point.x - drag.fromX + gap) / (column + gap),
      );
      const h = Math.round(
        (drag.fromHeight + point.y - drag.fromY + gap) / (rowHeight + gap),
      );
      setDraft(
        resizeItem(
          drag.start,
          drag.id,
          clamp(w, min.w, max.w),
          clamp(h, min.h, max.h),
          COLUMNS,
        ),
      );
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (!active) return;
    lastClient = { x: event.clientX, y: event.clientY };
    follow(canvasPoint(event.clientX, event.clientY));
  }

  function finish() {
    const drag = active;
    if (!drag) return;
    active = null;
    cancelAnimationFrame(scrollFrame);
    announcePosition(drag.id);
  }

  // Holding a widget near the top or bottom edge scrolls the page, so a long
  // layout can be rearranged without letting go.
  const EDGE = 72;
  function autoScroll() {
    if (!active) return;
    const { y } = lastClient;
    const speed =
      y < EDGE
        ? -Math.ceil((EDGE - y) / 6)
        : y > window.innerHeight - EDGE
          ? Math.ceil((y - (window.innerHeight - EDGE)) / 6)
          : 0;
    if (speed !== 0) {
      window.scrollBy(0, speed);
      follow(canvasPoint(lastClient.x, lastClient.y));
    }
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  // Keyboard: arrows move, Shift + arrows resize. Moving down past a widget
  // takes more than one row (gravity pulls it straight back up), so a step
  // grows until the layout actually changes.
  const ARROWS: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };

  function onHandleKey(
    event: KeyboardEvent,
    widget: HomeWidgetDto,
    { resize = event.shiftKey } = {},
  ) {
    const arrow = ARROWS[event.key];
    if (!arrow) return;
    event.preventDefault();
    const [dx, dy] = arrow;
    if (resize) {
      const { min, max } = HOME_WIDGETS[widget.type];
      setDraft(
        resizeItem(
          draft,
          widget.id,
          clamp(widget.w + dx, min.w, max.w),
          clamp(widget.h + dy, min.h, max.h),
          COLUMNS,
        ),
      );
    } else {
      for (let step = 1; step <= HOME_LAYOUT_LIMITS.maxHeight; step++) {
        const next = moveItem(
          draft,
          widget.id,
          widget.x + dx * step,
          widget.y + dy * step,
          COLUMNS,
        );
        const moved = next.find((w) => w.id === widget.id)!;
        if (moved.x !== widget.x || moved.y !== widget.y) {
          draft = next;
          break;
        }
        if (dx !== 0) break;
      }
    }
    announcePosition(widget.id);
  }

  let announcement = $state("");
  function announcePosition(id: string) {
    const widget = draft.find((w) => w.id === id);
    if (!widget) return;
    announcement = m.home_editor_position({
      name: HOME_WIDGETS[widget.type].title(),
      x: widget.x + 1,
      y: widget.y + 1,
      w: widget.w,
      h: widget.h,
    });
  }

  let catalogOpen = $state(false);
  let configuring = $state<string | null>(null);
  let arrived = $state<string | null>(null);
  const configuredWidget = $derived(draft.find((w) => w.id === configuring));

  async function add(type: HomeWidgetType) {
    const def = HOME_WIDGETS[type];
    const id = draft.some((w) => w.id === type)
      ? `${type}-${crypto.randomUUID().slice(0, 8)}`
      : type;
    const widget: HomeWidgetDto = {
      id,
      type,
      x: 0,
      y: bottomRow(draft),
      ...def.initial,
      ...(type === "quickLinks"
        ? { config: { links: DEFAULT_QUICK_LINKS } }
        : {}),
    };
    draft = compact([...draft, widget]);
    catalogOpen = false;
    announcement = m.home_editor_added({ name: def.title() });
    arrived = id;
    await tick();
    document.getElementById(`widget-${id}`)?.scrollIntoView({
      block: "center",
      behavior: reduced ? "auto" : "smooth",
    });
    // A list, a view or a note shows nothing until it's set up.
    if (type === "listContent" || type === "savedView" || type === "note") {
      configuring = id;
    }
  }

  function remove(widget: HomeWidgetDto) {
    draft = compact(draft.filter((w) => w.id !== widget.id));
    announcement = m.home_editor_removed({
      name: HOME_WIDGETS[widget.type].title(),
    });
  }

  function removeAll() {
    draft = [];
    announcement = m.home_editor_removed_all();
  }

  function applyConfig(id: string, config: HomeWidgetConfigDto) {
    draft = draft.map((w) => (w.id === id ? { ...w, config } : w));
  }

  const saveMut = createApiMutation(() => ({
    mutate: (widgets: HomeWidgetDto[]) => saveHomeLayout({ widgets }),
    onSuccess: () => (saved = clone(draft)),
    successToast: m.home_editor_saved(),
    errorToast: true,
  }));

  let confirmingReset = $state(false);
  const resetMut = createApiMutation(() => ({
    mutate: () => resetHomeLayout(),
    onSuccess: () => {
      saved = current();
      draft = clone(saved);
      confirmingReset = false;
    },
    successToast: m.home_editor_reset_done(),
    errorToast: true,
  }));

  function save() {
    // Widgets hidden by a disabled domain are written back untouched, so
    // they return where they were once it's turned on again.
    saveMut.mutate([
      ...clone(draft),
      ...hiddenWidgets(auth.user?.homeLayout, gate),
    ]);
  }

  beforeNavigate(({ cancel, type }) => {
    if (!dirty) return;
    // Closing the tab: cancelling is what makes the browser ask.
    if (type === "leave" || !confirm(m.home_editor_leave_confirm())) cancel();
  });

  const cellStyle = (widget: HomeWidgetDto) => {
    const moving = active?.kind === "move" && active.id === widget.id;
    const x = moving
      ? clamp(pointer.x - active!.grabX, 0, width - spanX(widget.w))
      : left(widget.x);
    const y = moving ? Math.max(0, pointer.y - active!.grabY) : top(widget.y);
    return `transform: translate(${x}px, ${y}px); width: ${spanX(widget.w)}px; height: ${spanY(widget.h)}px;`;
  };
  const activeWidget = $derived(
    active ? draft.find((w) => w.id === active!.id) : undefined,
  );
</script>

{#snippet resizeHandle(widget: HomeWidgetDto, cls: string)}
  {@const name = HOME_WIDGETS[widget.type].title()}
  <button
    type="button"
    class="control cursor-se-resize touch-none {cls}"
    aria-label={m.home_editor_resize({ name })}
    title={m.home_editor_resize({ name })}
    onpointerdown={(e) => begin("resize", widget, e)}
    onpointermove={onPointerMove}
    onpointerup={finish}
    onpointercancel={finish}
    onkeydown={(e) => onHandleKey(e, widget, { resize: true })}>
    <Icon name="resize" class="h-4 w-4" />
  </button>
{/snippet}

<div
  class="bg-bg/85 border-border sticky top-0 z-40 -mx-5 mb-4 flex flex-wrap items-center gap-2 border-b px-5 py-3 backdrop-blur md:-mx-8 md:px-8">
  <div class="min-w-0 flex-1 text-xs">
    {#if dirty && !hasContent}
      <span class="text-dim" in:fade={{ duration: reduced ? 0 : 150 }}>
        {m.home_editor_needs_widget()}
      </span>
    {:else if dirty}
      <span
        class="text-accent inline-flex items-center gap-1.5 font-semibold"
        in:fade={{ duration: reduced ? 0 : 150 }}>
        <span
          class="bg-accent h-1.5 w-1.5 rounded-full motion-safe:animate-pulse"
        ></span>
        {m.home_editor_unsaved()}
      </span>
    {/if}
  </div>

  <button
    type="button"
    class="btn-text text-xs"
    disabled={usingDefault || resetMut.loading}
    onclick={() => (confirmingReset = true)}>
    {m.home_editor_reset()}
  </button>
  <button
    type="button"
    class="btn btn-ghost btn-sm"
    disabled={draft.length === 0 || saveMut.loading}
    onclick={removeAll}>
    {m.home_editor_remove_all()}
  </button>
  <button
    type="button"
    class="btn btn-primary btn-sm"
    disabled={!dirty || !hasContent || saveMut.loading}
    onclick={save}>
    {m.common_save()}
  </button>
</div>

<div class="text-dim mb-4 space-y-1 text-xs">
  {#if usingDefault}
    <p class="flex items-start gap-1.5">
      <Icon name="sparkles" class="text-accent mt-px h-3.5 w-3.5 shrink-0" />
      {m.home_editor_using_default()}
    </p>
  {/if}
  {#if plan && width > 0}
    <p>{m.home_editor_narrow_hint()}</p>
  {/if}
  <p class="hidden md:block">{m.home_editor_keyboard_hint()}</p>
</div>

<p class="sr-only" aria-live="polite">{announcement}</p>

<div bind:clientWidth={width}>
  {#if width > 0}
    <div
      bind:this={canvas}
      class="relative select-none"
      class:cursor-grabbing={active?.kind === "move"}
      style:height={`${spanY(canvasRows)}px`}>
      <!-- A dot at every gutter crossing: the grid's rhythm without drawing
             its cells, which fought the widgets for attention. It wakes up
             during a drag, when the snap points are what you're looking at. -->
      <div
        class="dots pointer-events-none absolute inset-0"
        class:awake={!!active}
        style:--pitch-x={`${column + gap}px`}
        style:--pitch-y={`${rowHeight + gap}px`}
        style:--gap={`${gap}px`}
        aria-hidden="true">
      </div>

      <!-- The columns a dragged widget will land on, lit like a projector
           beam — over the widgets it passes, under the one being held. A
           resize stays in its own columns: nothing to point at there. -->
      {#if active?.kind === "move" && activeWidget}
        <div
          class="beam pointer-events-none absolute top-0 bottom-0 left-0 z-20 motion-safe:transition-[transform,width] motion-safe:duration-150"
          style:transform={`translateX(${left(activeWidget.x)}px)`}
          style:width={`${spanX(activeWidget.w)}px`}
          aria-hidden="true"
          transition:fade={{ duration: reduced ? 0 : 150 }}>
        </div>
      {/if}

      {#if active?.kind === "move" && activeWidget}
        <div
          class="border-accent/70 bg-accent/10 absolute top-0 left-0 rounded-xl border-2 border-dashed motion-safe:transition-[transform,width,height] motion-safe:duration-150"
          style:transform={`translate(${left(activeWidget.x)}px, ${top(activeWidget.y)}px)`}
          style:width={`${spanX(activeWidget.w)}px`}
          style:height={`${spanY(activeWidget.h)}px`}
          transition:fade={{ duration: reduced ? 0 : 120 }}>
        </div>
      {/if}

      {#each draft as widget (widget.id)}
        {@const def = HOME_WIDGETS[widget.type]}
        {@const lifted = active?.id === widget.id}
        {@const moving = lifted && active?.kind === "move"}
        {@const tight = spanY(widget.h) < 76}
        {@const thin = spanX(widget.w) < 96}
        <div
          id="widget-{widget.id}"
          class="group absolute top-0 left-0 {lifted ? 'z-30' : 'z-10'} {moving
            ? ''
            : 'motion-safe:transition-[transform,width,height] motion-safe:duration-200 motion-safe:ease-out'}"
          style={cellStyle(widget)}
          in:scale|global={{ start: 0.94, duration: reduced ? 0 : 220 }}
          out:scale={{ start: 0.94, duration: reduced ? 0 : 160 }}>
          <div
            class="relative h-full rounded-xl transition-[box-shadow,scale] duration-150 {lifted
              ? 'ring-accent scale-[1.015] shadow-2xl ring-2'
              : 'group-hover:ring-accent/50 group-focus-within:ring-accent/70 ring-1 ring-transparent'} {arrived ===
            widget.id
              ? 'arrive'
              : ''}"
            onanimationend={(e) => {
              if (e.target === e.currentTarget) arrived = null;
            }}>
            {#if isDivider(widget.type)}
              <!-- A hairline alone is hard to find and grab: outlined here. -->
              <div
                class="border-border/70 h-full rounded-lg border border-dashed"
                inert>
                <HomeWidget
                  {widget}
                  size={{
                    width: spanX(widget.w),
                    height: spanY(widget.h),
                  }} />
              </div>
            {:else if plan}
              <div
                class="card flex h-full items-end overflow-hidden p-1.5 pl-2">
                <span
                  class="flex min-w-0 items-center gap-1 text-[0.65rem] leading-tight font-semibold">
                  <Icon name={def.icon} class="text-accent h-3 w-3 shrink-0" />
                  <span class="truncate">{def.title()}</span>
                </span>
              </div>
            {:else}
              <div class="pointer-events-none h-full" inert>
                <HomeWidget
                  {widget}
                  size={{
                    width: spanX(widget.w),
                    height: spanY(widget.h),
                  }} />
              </div>
            {/if}

            <!-- Controls: on hover or focus with a mouse, always on touch.
                   A one-cell-thick widget (a divider) lines them up along
                   its length instead. -->
            <div
              class="absolute flex gap-1 transition-opacity duration-150 {thin
                ? 'inset-y-1 left-1/2 -translate-x-1/2 flex-col items-center'
                : tight
                  ? 'inset-x-1 top-1/2 -translate-y-1/2 items-center'
                  : 'inset-x-1 top-1 items-start'} {lifted
                ? 'opacity-100'
                : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100'}">
              <button
                type="button"
                class="control cursor-grab touch-none active:cursor-grabbing"
                aria-label={m.home_editor_move({ name: def.title() })}
                title={m.home_editor_move({ name: def.title() })}
                onpointerdown={(e) => begin("move", widget, e)}
                onpointermove={onPointerMove}
                onpointerup={finish}
                onpointercancel={finish}
                onkeydown={(e) => onHandleKey(e, widget)}>
                <Icon name="grip" class="h-4 w-4" />
              </button>
              <span class="flex-1"></span>
              {#if def.configurable}
                <button
                  type="button"
                  class="control"
                  aria-label={m.home_editor_configure({ name: def.title() })}
                  title={m.home_editor_configure({ name: def.title() })}
                  onclick={() => (configuring = widget.id)}>
                  <Icon name="gear" class="h-4 w-4" />
                </button>
              {/if}
              <button
                type="button"
                class="control hover:text-danger"
                aria-label={m.home_editor_remove({ name: def.title() })}
                title={m.home_editor_remove({ name: def.title() })}
                onclick={() => remove(widget)}>
                <Icon name="x" class="h-4 w-4" />
              </button>
              {#if tight || thin}
                {@render resizeHandle(widget, "")}
              {/if}
            </div>
            {#if !tight && !thin}
              {@render resizeHandle(
                widget,
                `absolute right-1 bottom-1 transition-opacity duration-150 ${
                  lifted
                    ? "opacity-100"
                    : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                }`,
              )}
            {/if}

            {#if lifted}
              <span
                class="timecode bg-bg/90 border-accent/50 text-accent pointer-events-none absolute rounded-md border px-1.5 py-0.5 text-[0.65rem] whitespace-nowrap shadow {tight ||
                thin
                  ? 'bottom-full left-0 mb-1.5'
                  : 'bottom-1.5 left-1.5'}"
                transition:fade={{ duration: reduced ? 0 : 120 }}>
                {m.home_editor_readout({
                  x: String(widget.x + 1).padStart(2, "0"),
                  y: String(widget.y + 1).padStart(2, "0"),
                  w: widget.w,
                  h: widget.h,
                })}
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <button
      type="button"
      class="group border-border text-dim hover:border-accent hover:text-accent hover:bg-accent/5 mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
      disabled={full}
      onclick={() => (catalogOpen = true)}>
      <Icon
        name="plus"
        class="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
      {m.home_editor_add()}
    </button>
  {/if}
</div>

{#if catalogOpen}
  <WidgetCatalogModal
    placed={placedTypes}
    onpick={add}
    onclose={() => (catalogOpen = false)} />
{/if}

{#if configuredWidget}
  <WidgetConfigModal
    widget={configuredWidget}
    onapply={(config) => applyConfig(configuredWidget.id, config)}
    onclose={() => (configuring = null)} />
{/if}

{#if confirmingReset}
  <ConfirmationModal
    title={m.home_editor_reset()}
    message={m.home_editor_reset_confirm()}
    confirmLabel={m.common_reset()}
    busy={resetMut.loading}
    onConfirm={() => resetMut.mutate()}
    onCancel={() => (confirmingReset = false)} />
{/if}

<style>
  .dots {
    background-image: radial-gradient(
      circle at calc(var(--pitch-x) - var(--gap) / 2)
        calc(var(--pitch-y) - var(--gap) / 2),
      var(--dim) 1.25px,
      transparent 1.75px
    );
    background-size: var(--pitch-x) var(--pitch-y);
    opacity: 0.5;
    transition: opacity 200ms;
  }
  .dots.awake {
    opacity: 0.9;
  }

  .beam {
    background: linear-gradient(
      to bottom,
      transparent,
      color-mix(in srgb, var(--accent) 7%, transparent) 12%,
      color-mix(in srgb, var(--accent) 7%, transparent) 88%,
      transparent
    );
    border-inline: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .control {
    display: grid;
    place-items: center;
    height: 1.75rem;
    width: 1.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border);
    background-color: color-mix(in srgb, var(--bg) 88%, transparent);
    color: var(--fg);
    backdrop-filter: blur(6px);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
    transition:
      background-color 150ms,
      color 150ms,
      transform 150ms;
  }
  .control:hover {
    background-color: var(--surface-2);
  }
  .control:active {
    transform: scale(0.92);
  }
  .control:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  /* A widget just added from the catalog lights up once, so the eye finds it. */
  .arrive {
    animation: arrive 900ms ease-out;
  }
  @keyframes arrive {
    0% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 70%, transparent);
    }
    100% {
      box-shadow: 0 0 0 14px transparent;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .arrive {
      animation: none;
    }
  }
  :global(.a11y-reduce-motion) .arrive {
    animation: none;
  }
</style>
