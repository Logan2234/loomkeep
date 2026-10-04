<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import { theme } from "$lib/theme.svelte";
  import { foldAdminSearch } from "$lib/admin-search";
  import { downloadBlob } from "$lib/download";
  import { tick } from "svelte";

  let { code }: { code: string } = $props();
  let svg = $state("");
  let error = $state<string | null>(null);
  let loading = $state(true);
  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let dragging = $state(false);
  let viewport = $state<HTMLDivElement>();
  let canvas = $state<HTMLDivElement>();
  let container = $state<HTMLDivElement>();
  let search = $state("");
  let tableNames = $state<string[]>([]);
  let selectedTable = $state("");
  let copied = $state(false);
  let revision = $state(0);
  let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };
  const ZOOM_MIN = 0.1;
  const ZOOM_MAX = 10;
  const results = $derived(
    tableNames.filter((name) =>
      foldAdminSearch(name).includes(foldAdminSearch(search)),
    ),
  );

  $effect(() => {
    const source = code;
    const dark = theme.mode === "dark";
    void revision;
    let cancelled = false;
    loading = true;
    error = null;
    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? "dark" : "default",
          securityLevel: "strict",
        });
        const result = await mermaid.render(
          `mermaid-${Math.random().toString(36).slice(2)}`,
          source,
        );
        if (cancelled) return;
        svg = result.svg;
        loading = false;
        await tick();
        const diagram = canvas?.querySelector("svg");
        const box = diagram?.viewBox?.baseVal;
        if (diagram && box?.width && box.height) {
          diagram.setAttribute("width", String(box.width));
          diagram.setAttribute("height", String(box.height));
          diagram.style.width = `${box.width}px`;
          diagram.style.height = `${box.height}px`;
          diagram.style.maxWidth = "none";
        }
        tableNames = tableNodes().map(tableName).sort();
        selectedTable = "";
        fit();
      } catch {
        if (!cancelled) {
          error = m.mermaid_invalid();
          loading = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  });

  function reset() {
    scale = 1;
    panX = 0;
    panY = 0;
  }
  function tableNodes(): SVGGElement[] {
    return Array.from(
      canvas?.querySelectorAll<SVGGElement>(
        'g[id^="entity-"], g[id*="-entity-"]',
      ) ?? [],
    );
  }
  function tableName(node: SVGGElement): string {
    return node.id.replace(/^.*?entity-/, "").replace(/-\d+$/, "");
  }
  function zoom(
    next: number,
    x = (viewport?.clientWidth ?? 0) / 2,
    y = (viewport?.clientHeight ?? 0) / 2,
  ) {
    const value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    panX = x - ((x - panX) / scale) * value;
    panY = y - ((y - panY) / scale) * value;
    scale = value;
  }
  function fit() {
    const diagram = canvas?.querySelector("svg");
    if (!diagram || !viewport?.clientWidth || !viewport.clientHeight) return;
    const box = diagram.viewBox?.baseVal;
    if (!box) return;
    if (!box.width || !box.height) return;
    scale = Math.min(
      ZOOM_MAX,
      Math.max(
        ZOOM_MIN,
        Math.min(
          (viewport.clientWidth - 32) / box.width,
          (viewport.clientHeight - 32) / box.height,
        ),
      ),
    );
    panX = (viewport.clientWidth - box.width * scale) / 2;
    panY = (viewport.clientHeight - box.height * scale) / 2;
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement === container)
        await document.exitFullscreen();
      else await container?.requestFullscreen();
      await tick();
      requestAnimationFrame(fit);
    } catch {
      error = m.common_unavailable();
    }
  }
  async function locateTable(name: string) {
    selectedTable = name;
    const node = tableNodes().find((node) => tableName(node) === name);
    if (!node || !viewport) return;
    canvas
      ?.querySelectorAll("[data-search-match]")
      .forEach((item) => item.removeAttribute("data-search-match"));
    node.setAttribute("data-search-match", "true");
    const view = viewport.getBoundingClientRect();
    zoom(Math.max(1, scale));
    await tick();
    const updated = node.getBoundingClientRect();
    panX += view.width / 2 - (updated.left - view.left + updated.width / 2);
    panY += view.height / 2 - (updated.top - view.top + updated.height / 2);
    viewport.focus();
  }
  function keydown(event: KeyboardEvent) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [60, 0],
      ArrowRight: [-60, 0],
      ArrowUp: [0, 60],
      ArrowDown: [0, -60],
    };
    if (moves[event.key]) {
      event.preventDefault();
      panX += moves[event.key][0];
      panY += moves[event.key][1];
    } else if (["+", "=", "-"].includes(event.key)) {
      event.preventDefault();
      zoom(scale * (event.key === "-" ? 1 / 1.2 : 1.2));
    } else if (event.key === "Home") {
      event.preventDefault();
      fit();
    }
  }
  function startDrag(event: PointerEvent) {
    if (event.button !== 0) return;
    dragging = true;
    dragStart = { x: event.clientX, y: event.clientY, panX, panY };
    viewport?.setPointerCapture(event.pointerId);
  }
  function onDrag(event: PointerEvent) {
    if (!dragging) return;
    panX = dragStart.panX + event.clientX - dragStart.x;
    panY = dragStart.panY + event.clientY - dragStart.y;
  }
  function onWheel(event: WheelEvent) {
    event.preventDefault();
    const rect = viewport!.getBoundingClientRect();
    zoom(
      scale * (event.deltaY < 0 ? 1.1 : 1 / 1.1),
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      error = m.common_unavailable();
    }
  }
</script>

<div
  bind:this={container}
  class="diagram-container bg-surface flex flex-col gap-3 p-1">
  <div class="flex flex-wrap items-center gap-2">
    <button
      class="btn btn-ghost btn-sm"
      onclick={() => zoom(scale / 1.2)}
      aria-label={m.common_zoom_out()}>−</button>
    <span class="timecode min-w-12 text-center text-xs"
      >{Math.round(scale * 100)}%</span>
    <button
      class="btn btn-ghost btn-sm"
      onclick={() => zoom(scale * 1.2)}
      aria-label={m.common_zoom_in()}>+</button>
    <button class="btn btn-ghost btn-sm" onclick={reset}
      >{m.common_reset()}</button>
    <button class="btn btn-ghost btn-sm" onclick={fit} disabled={loading}
      >{m.admin_diagram_fit()}</button>
    <button class="btn btn-ghost btn-sm" onclick={fullscreen}
      >{m.admin_diagram_fullscreen()}</button>
    <button class="btn btn-ghost btn-sm" onclick={copy}
      >{copied ? m.common_copied() : m.admin_diagram_copy()}</button>
    <button
      class="btn btn-ghost btn-sm"
      disabled={!svg || loading}
      onclick={() => downloadBlob(svg, "image/svg+xml", "loomkeep-schema.svg")}
      >{m.admin_diagram_export()}</button>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <input
      class="input max-w-sm"
      type="search"
      bind:value={search}
      aria-label={m.admin_diagram_search()}
      placeholder={m.admin_diagram_search()} />
    {#if search}<select
        class="input max-w-sm"
        aria-label={m.common_results()}
        value={selectedTable}
        onchange={(event) => locateTable(event.currentTarget.value)}
        ><option value="">{m.common_results()} ({results.length})</option
        >{#each results as name (name)}<option value={name}>{name}</option
          >{/each}</select
      >{/if}
  </div>
  <p id="diagram-keyboard" class="text-dim text-xs">
    {m.admin_diagram_keyboard()}
  </p>
  {#if error}<div
      role="alert"
      class="text-danger flex items-center gap-3 text-sm">
      {error}<button class="btn btn-ghost btn-sm" onclick={() => revision++}
        >{m.common_retry()}</button>
    </div>{/if}
  {#if loading}<p role="status" class="text-dim">{m.common_loading()}</p>{/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (The diagram provides keyboard pan and zoom as an interactive application.) -->
  <div
    bind:this={viewport}
    role="application"
    tabindex="0"
    aria-label={m.mermaid_pan_hint()}
    aria-describedby="diagram-keyboard"
    aria-busy={loading}
    class="diagram-viewport border-border bg-surface relative h-[75dvh] shrink-0 touch-none overflow-hidden rounded-lg border {dragging
      ? 'cursor-grabbing'
      : 'cursor-grab'}"
    onkeydown={keydown}
    onpointerdown={startDrag}
    onpointermove={onDrag}
    onpointerup={() => (dragging = false)}
    onpointercancel={() => (dragging = false)}
    onwheel={onWheel}>
    <div
      bind:this={canvas}
      style="transform: translate({panX}px, {panY}px) scale({scale}); transform-origin: top left;"
      class="absolute top-0 left-0 [&_svg]:max-w-none">
      <!-- Mermaid sanitizes its output with securityLevel: strict. -->
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html svg}
    </div>
  </div>
</div>

<style>
  .diagram-container:fullscreen {
    height: 100vh;
    padding: 1rem;
  }
  .diagram-container:fullscreen .diagram-viewport {
    height: auto;
    min-height: 0;
    flex: 1;
  }
  .diagram-viewport :global([data-search-match] .outer-path path),
  .diagram-viewport :global([data-search-match] > rect) {
    stroke: var(--accent) !important;
    stroke-width: 4px !important;
  }
</style>
