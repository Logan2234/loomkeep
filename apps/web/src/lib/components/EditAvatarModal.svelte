<script lang="ts">
  import { deleteAvatar, uploadAvatar } from "$lib/api/client";
  import { ApiError } from "$lib/api/core";
  import type { UploadAvatarRequestDto } from "@loomkeep/shared";
  import Avatar from "./Avatar.svelte";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";

  // Stored/uploaded avatars are always square, so there is never slack to pan
  // on an already-cropped one — the drag-to-reposition canvas only turns on
  // once a fresh (non-square) source photo is picked. Output resolution
  // matches the server's stored size.
  const OUTPUT_SIZE = 512;
  const PREVIEW_SIZE = 260;

  let {
    seed,
    avatarUrl,
    onSaved,
    onclose,
  }: {
    seed: string;
    avatarUrl: string | null;
    onSaved: (avatarUrl: string | null) => void;
    onclose: () => void;
  } = $props();

  let stage = $state<"idle" | "editing">("idle");
  let status = $state<"idle" | "saving" | "error">("idle");
  let error = $state("");

  // Modal renders its content twice in parallel (a mobile Drawer copy and a
  // desktop dialog copy, toggled by CSS breakpoint, not conditional
  // rendering — see Modal.svelte), so a plain `bind:this` would silently
  // grab whichever copy mounts last rather than the one actually on screen.
  // Register every mounted instance and resolve the one whose *dialog
  // ancestor* currently has layout — not the element's own offsetParent,
  // since the file input is deliberately `display:none` in both copies
  // regardless of which one is active.
  function registry<T extends HTMLElement>() {
    let els: T[] = [];
    return {
      register: (node: T) => {
        els = [...els, node];
        return {
          destroy() {
            els = els.filter((el) => el !== node);
          },
        };
      },
      visible: () =>
        els.find((el) => {
          const dialog = el.closest('[role="dialog"]') as HTMLElement | null;
          return dialog !== null && dialog.offsetParent !== null;
        }),
    };
  }
  const fileInputs = registry<HTMLInputElement>();
  const canvases = registry<HTMLCanvasElement>();

  let bitmap: ImageBitmap | null = null;
  // Top-left of the square crop window, in source-image pixel space.
  let cropX = 0;
  let cropY = 0;
  let cropSide = 0;

  function clampCrop() {
    if (!bitmap) return;
    cropX = Math.min(Math.max(cropX, 0), bitmap.width - cropSide);
    cropY = Math.min(Math.max(cropY, 0), bitmap.height - cropSide);
  }

  function draw() {
    const canvasEl = canvases.visible();
    if (!bitmap || !canvasEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    ctx.drawImage(
      bitmap,
      cropX,
      cropY,
      cropSide,
      cropSide,
      0,
      0,
      PREVIEW_SIZE,
      PREVIEW_SIZE,
    );
  }

  async function onFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    error = "";
    bitmap = await createImageBitmap(file);
    cropSide = Math.min(bitmap.width, bitmap.height);
    // Start centered — the same starting point the old fixed center-crop used.
    cropX = (bitmap.width - cropSide) / 2;
    cropY = (bitmap.height - cropSide) / 2;
    stage = "editing";
    requestAnimationFrame(draw);
    (e.target as HTMLInputElement).value = "";
  }

  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartCropX = 0;
  let dragStartCropY = 0;

  function onPointerDown(e: PointerEvent) {
    if (!bitmap) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartCropX = cropX;
    dragStartCropY = cropY;
    // The event only ever fires on the element the user actually touched —
    // no need to resolve "the visible one" separately here.
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || !bitmap) return;
    // The preview is `cropSide` source-px stretched to PREVIEW_SIZE — convert
    // pointer movement back to source-px, and follow the pointer (dragging
    // right reveals more of the image's left side, like sliding a photo
    // under a fixed window).
    const ratio = cropSide / PREVIEW_SIZE;
    cropX = dragStartCropX - (e.clientX - dragStartX) * ratio;
    cropY = dragStartCropY - (e.clientY - dragStartY) * ratio;
    clampCrop();
    draw();
  }

  function onPointerUp(e: PointerEvent) {
    dragging = false;
    (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
  }

  function cancelEdit() {
    stage = "idle";
    bitmap = null;
    error = "";
  }

  async function save() {
    if (!bitmap) return;
    status = "saving";
    error = "";
    try {
      const out = document.createElement("canvas");
      out.width = OUTPUT_SIZE;
      out.height = OUTPUT_SIZE;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("Canvas non supporté");
      ctx.drawImage(
        bitmap,
        cropX,
        cropY,
        cropSide,
        cropSide,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );
      const dataUrl = out.toDataURL("image/webp", 0.85);
      const [header, data] = dataUrl.split(",");
      const mimeType = (header.match(/data:(.*);base64/)?.[1] ??
        "image/webp") as UploadAvatarRequestDto["mimeType"];
      const user = await uploadAvatar({ mimeType, data });
      status = "idle";
      onSaved(user.avatarUrl);
      onclose();
    } catch (err) {
      status = "error";
      error =
        err instanceof ApiError ? err.message : "Envoi de l'image impossible";
    }
  }

  async function remove() {
    status = "saving";
    error = "";
    try {
      const user = await deleteAvatar();
      status = "idle";
      onSaved(user.avatarUrl);
      onclose();
    } catch (err) {
      status = "error";
      error = err instanceof ApiError ? err.message : "Suppression impossible";
    }
  }
</script>

<Modal title="Photo de profil" {onclose}>
  <div class="flex flex-col items-center gap-4">
    <div
      class="bg-surface-2 border-border/60 relative overflow-hidden rounded-md border"
      style="width: {PREVIEW_SIZE}px; height: {PREVIEW_SIZE}px;">
      {#if stage === "editing"}
        <canvas
          use:canvases.register
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          class="h-full w-full cursor-grab touch-none active:cursor-grabbing"
          onpointerdown={onPointerDown}
          onpointermove={onPointerMove}
          onpointerup={onPointerUp}
          onpointercancel={onPointerUp}></canvas>
      {:else}
        <Avatar {seed} url={avatarUrl} size={PREVIEW_SIZE} />
      {/if}
    </div>

    {#if stage === "editing"}
      <p class="text-dim max-w-xs text-center text-sm">
        Faites glisser l'image pour choisir le cadrage.
      </p>
    {/if}

    {#if error}
      <p class="text-danger text-center text-sm">{error}</p>
    {/if}

    <input
      use:fileInputs.register
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="hidden"
      onchange={onFileSelected} />

    <div class="flex w-full flex-col gap-2">
      {#if stage === "editing"}
        <button
          class="btn btn-primary w-full"
          disabled={status === "saving"}
          onclick={save}>
          <Icon name="check" class="h-4 w-4" />
          Enregistrer
        </button>
        <button
          class="btn btn-ghost w-full"
          disabled={status === "saving"}
          onclick={cancelEdit}>
          Annuler
        </button>
      {:else}
        <button
          class="btn btn-ghost w-full"
          disabled={status === "saving"}
          onclick={() => fileInputs.visible()?.click()}>
          <Icon name="edit" class="h-4 w-4" />
          Changer la photo
        </button>
        {#if avatarUrl}
          <button
            class="btn btn-ghost w-full"
            disabled={status === "saving"}
            onclick={remove}>
            <Icon name="trash" class="h-4 w-4" />
            Supprimer l'avatar
          </button>
        {/if}
      {/if}
    </div>
  </div>
</Modal>
