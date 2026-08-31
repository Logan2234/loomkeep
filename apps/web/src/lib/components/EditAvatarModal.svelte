<script lang="ts">
  import { deleteAvatar, uploadAvatar } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import type { UploadAvatarRequestDto } from "@loomkeep/shared";
  import { m } from "$lib/paraglide/messages.js";
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

  let fileInput: HTMLInputElement | undefined = $state();
  let canvasEl: HTMLCanvasElement | undefined = $state();

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
    saveMut.reset();
    bitmap = await createImageBitmap(file);
    cropSide = Math.min(bitmap.width, bitmap.height);
    // Start centered — the same starting point the old fixed center-crop used.
    cropX = (bitmap.width - cropSide) / 2;
    cropY = (bitmap.height - cropSide) / 2;
    stage = "editing";
    requestAnimationFrame(draw);
    if (fileInput) fileInput.value = "";
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
    canvasEl?.setPointerCapture(e.pointerId);
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
    canvasEl?.releasePointerCapture(e.pointerId);
  }

  function cancelEdit() {
    stage = "idle";
    bitmap = null;
    saveMut.reset();
  }

  function cropToPayload(): UploadAvatarRequestDto {
    const out = document.createElement("canvas");
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext("2d");
    if (!ctx) throw new Error("Canvas non supporté");
    ctx.drawImage(
      bitmap!,
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
    return { mimeType, data };
  }

  const saveMut = createApiMutation(() => ({
    mutate: () => uploadAvatar(cropToPayload()),
    onSuccess: (user) => {
      onSaved(user.avatarUrl);
      onclose();
    },
  }));

  function save() {
    if (!bitmap) return;
    saveMut.mutate();
  }

  const removeMut = createApiMutation(() => ({
    mutate: deleteAvatar,
    onSuccess: (user) => {
      onSaved(user.avatarUrl);
      onclose();
    },
  }));

  function remove() {
    removeMut.mutate();
  }

  const status = $derived<"idle" | "saving" | "error">(
    saveMut.loading || removeMut.loading
      ? "saving"
      : saveMut.error || removeMut.error
        ? "error"
        : "idle",
  );
  const error = $derived(saveMut.error ?? removeMut.error);
</script>

<Modal title={m.profile_photo()} {onclose}>
  <div class="flex flex-col items-center gap-4">
    <div
      class="bg-surface-2 border-border/60 relative overflow-hidden rounded-md border"
      style="width: {PREVIEW_SIZE}px; height: {PREVIEW_SIZE}px;">
      {#if stage === "editing"}
        <canvas
          bind:this={canvasEl}
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
        {m.profile_photo_crop_hint()}
      </p>
    {/if}

    {#if error}
      <p class="text-danger text-center text-sm">{error}</p>
    {/if}

    <input
      bind:this={fileInput}
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
          {m.common_save()}
        </button>
        <button
          class="btn btn-ghost w-full"
          disabled={status === "saving"}
          onclick={cancelEdit}>
          {m.common_cancel()}
        </button>
      {:else}
        <button
          class="btn btn-ghost w-full"
          disabled={status === "saving"}
          onclick={() => fileInput?.click()}>
          <Icon name="edit" class="h-4 w-4" />
          {m.profile_photo_change()}
        </button>
        {#if avatarUrl}
          <button
            class="btn btn-ghost w-full"
            disabled={status === "saving"}
            onclick={remove}>
            <Icon name="trash" class="h-4 w-4" />
            {m.profile_avatar_delete()}
          </button>
        {/if}
      {/if}
    </div>
  </div>
</Modal>
