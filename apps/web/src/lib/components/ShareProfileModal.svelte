<script lang="ts">
  import QRCode from "qrcode";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";
  import { profileUrl } from "$lib/share-profile";

  // Fallback for browsers without the native share sheet (desktop, mostly):
  // the link to copy, and a QR code a phone can scan straight off the screen.
  let { username, onclose }: { username: string; onclose: () => void } =
    $props();

  let url = $derived(profileUrl(username));
  let qrSvg = $state("");
  let copied = $state(false);

  $effect(() => {
    QRCode.toString(url, {
      type: "svg",
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).then((svg) => (qrSvg = svg));
  });

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<Modal title="Partager le profil" {onclose}>
  <div class="flex flex-col items-center gap-4">
    {#if qrSvg}
      <!-- Fixed white backing regardless of theme — the QR needs strong
           light/dark module contrast to stay scannable, independent of the
           app's own dark mode. -->
      <div class="qr-frame rounded-xl bg-white p-3">
        <!-- svg is qrcode's own generated markup (rects/paths only), not user input -->
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html qrSvg}
      </div>
    {:else}
      <div class="bg-surface-2 h-48 w-48 animate-pulse rounded-xl"></div>
    {/if}

    <p class="text-dim max-w-xs text-center text-sm">
      À scanner avec l'appareil photo d'un téléphone pour ouvrir directement ce
      profil.
    </p>

    <button class="btn btn-ghost w-full" onclick={copyLink}>
      <Icon name={copied ? "check" : "share"} class="h-4 w-4" />
      {copied ? "Lien copié" : "Copier le lien"}
    </button>
  </div>
</Modal>

<style>
  /* qrcode's SVG output has no intrinsic size beyond its viewBox — pin one. */
  .qr-frame :global(svg) {
    width: 200px;
    height: 200px;
  }
</style>
