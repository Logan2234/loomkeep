<script lang="ts">
  // Prompts once per device, shortly after the app opens, to enable push —
  // manual activation from Réglages (CommunicationsSection) still exists
  // regardless. `Notification.permission` ("granted"/"denied"/"default") is
  // the source of truth for whether the native browser prompt has ever been
  // answered, but it can't distinguish "never asked" from "our own
  // explanation screen was already shown and closed without a clear
  // choice" — a separate per-device localStorage flag tracks that.
  import { browser } from "$app/environment";
  import { ApiError, updateMe } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import { enablePush, isPushSupported } from "$lib/push";
  import Modal from "./Modal.svelte";

  const STORAGE_KEY = "loomkeep.push-intro-shown";

  let open = $state(false);
  let busy = $state(false);
  let error = $state("");

  $effect(() => {
    if (!browser || !auth.isLoggedIn) return;
    if (!isPushSupported()) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    open = true;
  });

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    open = false;
  }

  async function enable() {
    busy = true;
    error = "";
    try {
      const ok = await enablePush();
      if (!ok) {
        error = "Notifications refusées ou indisponibles sur cet appareil.";
        return;
      }
      await updateMe({ notifyPush: true });
      open = false;
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    } finally {
      busy = false;
      localStorage.setItem(STORAGE_KEY, "1");
    }
  }
</script>

{#if open}
  <Modal title="Active les notifications" onclose={dismiss}>
    <p class="text-dim">
      Reçois une alerte dès qu'un nouvel épisode suivi sort, même appli fermée.
      Modifiable à tout moment depuis Réglages.
    </p>
    {#if error}
      <p class="text-danger mt-2 text-sm">{error}</p>
    {/if}
    <div class="mt-5 flex justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        disabled={busy}
        onclick={dismiss}>
        Plus tard
      </button>
      <button
        type="button"
        class="btn btn-primary"
        disabled={busy}
        onclick={enable}>
        Activer
      </button>
    </div>
  </Modal>
{/if}
