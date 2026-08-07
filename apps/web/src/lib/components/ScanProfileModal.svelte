<script lang="ts">
  // In-app QR scanner: reads someone's profile QR (see ShareProfileModal)
  // straight off their screen and jumps to it — no need to leave the app to
  // let a camera app open the URL. Only ever mounted on mobile (the trigger
  // button that opens this is hidden on desktop), since it's meant for
  // "point your phone at their phone", not a webcam use case.
  import { goto } from "$app/navigation";
  import QrScanner from "qr-scanner";
  import WorkerPath from "qr-scanner/qr-scanner-worker.min.js?url";
  import { onDestroy, onMount, tick } from "svelte";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";

  QrScanner.WORKER_PATH = WorkerPath;

  let { onclose }: { onclose: () => void } = $props();

  let videoEl: HTMLVideoElement | undefined = $state();
  let scanner: QrScanner | undefined;
  let status = $state<"starting" | "scanning" | "denied" | "error">("starting");
  let notice = $state("");

  // Only a same-origin `/u/:username` link resolves in-app — a QR scanned
  // from anything else (a random URL, another site's code) is rejected
  // rather than silently opened, since this modal's whole point is a fast
  // path straight to a profile, not a general-purpose QR reader.
  function resolveUsername(data: string): string | null {
    try {
      const url = new URL(data);
      if (url.origin !== window.location.origin) return null;
      const match = url.pathname.match(/^\/u\/([^/]+)\/?$/);
      return match ? decodeURIComponent(match[1]) : null;
    } catch {
      return null;
    }
  }

  async function onDecode(result: QrScanner.ScanResult) {
    const username = resolveUsername(result.data);
    if (!username) {
      notice = "Ce code ne correspond pas à un profil Loomkeep.";
      return;
    }
    notice = "";
    // Stop the camera and let the modal actually unmount (`onclose` just
    // flips a flag in the parent — without waiting a tick, `goto()` could
    // start the same-route navigation to /u/[username] before Svelte has
    // applied that DOM removal, leaving the drawer/dialog visibly stuck).
    await scanner?.stop();
    scanner?.destroy();
    onclose();
    await tick();
    await goto(`/u/${username}`);
  }

  onMount(async () => {
    if (!videoEl) return;
    scanner = new QrScanner(videoEl, onDecode, {
      preferredCamera: "environment",
      highlightScanRegion: true,
      maxScansPerSecond: 5,
    });
    try {
      await scanner.start();
      status = "scanning";
    } catch {
      status = "denied";
    }
  });

  onDestroy(() => {
    scanner?.stop();
    scanner?.destroy();
  });
</script>

<Modal title="Scanner un profil" {onclose}>
  <div class="flex flex-col items-center gap-3">
    <div
      class="bg-surface-2 relative aspect-square w-full overflow-hidden rounded-xl">
      <!-- The video must never be visibility:hidden/display:none — qr-scanner
           treats a hidden video at start-up as "hidden on purpose" (a Safari
           workaround for a video-hiding bug) and responds by force-zeroing
           its opacity/width/height via inline styles, which then never
           recovers even once we flip our own class back. The "starting"/
           "denied" placeholders sit on an opaque background on top of it
           instead of toggling the video's own visibility. -->
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
          Accès à la caméra refusé ou indisponible.
        </div>
      {/if}
    </div>

    <p class="text-dim max-w-xs text-center text-sm">
      Pointez la caméra vers le QR code du profil de quelqu'un d'autre.
    </p>

    {#if notice}
      <p class="text-danger text-center text-sm">{notice}</p>
    {/if}
  </div>
</Modal>
