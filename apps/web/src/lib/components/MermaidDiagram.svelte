<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import { theme } from "$lib/theme.svelte";

  let { code }: { code: string } = $props();

  let svg = $state("");
  let error = $state<string | null>(null);
  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let dragging = $state(false);
  let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };

  const ZOOM_STEP = 0.25;
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 3;

  // Re-render whenever the diagram source or the light/dark mode changes —
  // mermaid bakes colors into the SVG at render time, it can't be re-themed via CSS.
  $effect(() => {
    const source = code;
    const dark = theme.mode === "dark";
    let cancelled = false;

    (async () => {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({
        startOnLoad: false,
        theme: dark ? "dark" : "default",
        securityLevel: "strict",
      });
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const result = await mermaid.render(id, source);
        if (!cancelled) {
          // Mermaid hardcodes width/height/max-width to the diagram's natural
          // pixel size — override so it fills the container by default (the
          // viewBox keeps the aspect ratio correct); zoom scales from there.
          svg = result.svg
            .replace(/ width="[\d.]+"/, "")
            .replace(/ height="[\d.]+"/, "")
            .replace(
              /style="[^"]*"/,
              'style="width:100%;height:auto;display:block;"',
            );
          error = null;
        }
      } catch {
        if (!cancelled) error = m.mermaid_invalid();
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  function zoomIn() {
    scale = Math.min(ZOOM_MAX, scale + ZOOM_STEP);
  }
  function zoomOut() {
    scale = Math.max(ZOOM_MIN, scale - ZOOM_STEP);
  }
  function reset() {
    scale = 1;
    panX = 0;
    panY = 0;
  }

  function startDrag(e: PointerEvent) {
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, panX, panY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDrag(e: PointerEvent) {
    if (!dragging) return;
    panX = dragStart.panX + (e.clientX - dragStart.x);
    panY = dragStart.panY + (e.clientY - dragStart.y);
  }
  function endDrag() {
    dragging = false;
  }

  // Zooms toward the cursor: keeps the content point under the pointer fixed
  // on screen while scale changes, instead of always zooming from the corner.
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const newScale = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1)),
    );
    panX = cx - ((cx - panX) / scale) * newScale;
    panY = cy - ((cy - panY) / scale) * newScale;
    scale = newScale;
  }
</script>

{#if error}
  <p class="text-danger text-sm">{error}</p>
{:else}
  <div class="mb-2 flex items-center justify-end gap-1.5">
    <button
      onclick={zoomOut}
      aria-label={m.mermaid_zoom_out()}
      class="border-border text-dim hover:text-fg grid h-7 w-7 place-items-center rounded-md border text-sm">
      −
    </button>
    <span class="text-dim w-10 text-center text-xs tabular-nums">
      {Math.round(scale * 100)}%
    </span>
    <button
      onclick={zoomIn}
      aria-label={m.mermaid_zoom_in()}
      class="border-border text-dim hover:text-fg grid h-7 w-7 place-items-center rounded-md border text-sm">
      +
    </button>
    <button
      onclick={reset}
      class="border-border text-dim hover:text-fg ml-1 rounded-md border px-2 py-1 text-xs">
      {m.common_reset()}
    </button>
  </div>
  <div
    role="application"
    aria-label={m.mermaid_pan_hint()}
    class="border-border bg-surface h-[75vh] touch-none overflow-hidden rounded-lg border {dragging
      ? 'cursor-grabbing'
      : 'cursor-grab'}"
    onpointerdown={startDrag}
    onpointermove={onDrag}
    onpointerup={endDrag}
    onpointercancel={endDrag}
    onwheel={onWheel}>
    <div
      style="transform: translate({panX}px, {panY}px) scale({scale}); transform-origin: top left;"
      class="w-full p-4">
      <!-- svg is mermaid's own output with securityLevel: "strict" (sanitized), not user input -->
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html svg}
    </div>
  </div>
{/if}
