<script lang="ts">
  // In-app ISBN barcode scanner for the books search bar's "Par ISBN" mode.
  // Same "point your phone at it" idea as ScanProfileModal, but a book's back
  // cover carries an EAN-13 barcode, not a QR code — the `qr-scanner` package
  // used there is QR-only (jsQR-based), so this reads frames itself via the
  // native Shape Detection API instead of pulling in a second, heavier
  // barcode library. Only ever mounted on mobile with `BarcodeDetector`
  // support (the trigger button feature-detects and hides itself otherwise).
  import { onDestroy, onMount } from "svelte";
  import { m } from "$lib/paraglide/messages.js";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";

  let {
    onclose,
    ondetect,
  }: { onclose: () => void; ondetect: (isbn: string) => void } = $props();

  let videoEl: HTMLVideoElement | undefined = $state();
  let status = $state<"starting" | "scanning" | "denied" | "error">("starting");
  let stream: MediaStream | undefined;
  let frameHandle: number | undefined;
  let stopped = false;

  // Book ISBNs are EAN-13 codes under the "Bookland" 978/979 prefix — this
  // rules out a stray barcode from something else (a snack wrapper in frame)
  // being accepted as an ISBN.
  const ISBN_BARCODE = /^97[89]\d{10}$/;

  async function scanFrame(detector: BarcodeDetector) {
    if (stopped || !videoEl) return;
    try {
      const codes = await detector.detect(videoEl);
      const isbn = codes
        .map((c) => c.rawValue)
        .find((v) => ISBN_BARCODE.test(v));
      if (isbn) {
        stop();
        onclose();
        ondetect(isbn);
        return;
      }
    } catch {
      // Transient decode failures happen between frames (motion blur, no
      // code in view) — just keep scanning rather than surfacing an error.
    }
    frameHandle = requestAnimationFrame(() => scanFrame(detector));
  }

  function stop() {
    stopped = true;
    if (frameHandle !== undefined) cancelAnimationFrame(frameHandle);
    stream?.getTracks().forEach((track) => track.stop());
  }

  onMount(async () => {
    if (!videoEl) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      status = "scanning";
      void scanFrame(new BarcodeDetector({ formats: ["ean_13"] }));
    } catch {
      status = "denied";
    }
  });

  onDestroy(stop);
</script>

<Modal title={m.scan_isbn_title()} {onclose}>
  <div class="flex flex-col items-center gap-3">
    <div
      class="bg-surface-2 relative aspect-square w-full overflow-hidden rounded-xl">
      <!-- See ScanProfileModal for why the video must never be hidden via
           visibility/display — Safari force-zeroes it permanently otherwise. -->
      <video
        bind:this={videoEl}
        class="h-full w-full object-cover"
        muted
        playsinline></video>
      {#if status === "starting"}
        <div
          class="bg-surface-2 text-dim absolute inset-0 flex items-center justify-center">
          <Icon name="camera" class="h-8 w-8 animate-pulse" />
        </div>
      {:else if status === "denied"}
        <div
          class="bg-surface-2 text-dim absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm">
          <Icon name="camera" class="h-8 w-8" />
          {m.scan_isbn_camera_denied()}
        </div>
      {/if}
    </div>

    <p class="text-dim max-w-xs text-center text-sm">
      {m.scan_isbn_hint()}
    </p>
  </div>
</Modal>
