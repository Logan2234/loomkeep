<script lang="ts">
  import QRCode from "qrcode";
  import { m } from "$lib/paraglide/messages.js";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";
  import { profileUrl, shareProfile } from "$lib/share-profile";

  // The QR shows first, always — scanning straight off the screen is the
  // fastest path when two people are physically together. "Partager avec…"
  // and "Copier le lien" cover everything else (native share sheet where
  // supported, plain link otherwise).
  let {
    username,
    displayName,
    onclose,
  }: { username: string; displayName: string; onclose: () => void } = $props();

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

  async function shareWith() {
    await shareProfile(username, displayName);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<Modal title={m.share_profile_title()} {onclose}>
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
      {m.share_profile_hint()}
    </p>

    <div class="flex w-full flex-col gap-2">
      <button class="btn btn-primary w-full" onclick={shareWith}>
        <Icon name="share" class="h-4 w-4" />
        {m.share_profile_share_with()}
      </button>
      <button class="btn btn-ghost w-full" onclick={copyLink}>
        <Icon name={copied ? "check" : "link"} class="h-4 w-4" />
        {copied ? m.common_link_copied() : m.common_copy_link()}
      </button>
    </div>
  </div>
</Modal>

<style>
  /* qrcode's SVG output has no intrinsic size beyond its viewBox — pin one. */
  .qr-frame :global(svg) {
    width: 200px;
    height: 200px;
  }
</style>
