<script lang="ts">
  import { ApiError, updateMe } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import { disablePush, enablePush, isPushSupported } from "$lib/push";
  import { m } from "$lib/paraglide/messages.js";
  import Switch from "$lib/components/Switch.svelte";

  let notifyError = $state("");

  async function toggleNotify(
    key: "notifyEmail" | "notifyPush" | "notifyNewsletter",
  ) {
    if (!auth.user) return;
    notifyError = "";
    const value = !auth.user[key];
    try {
      await updateMe({ [key]: value });
    } catch (err) {
      notifyError =
        err instanceof ApiError ? err.message : m.common_save_error_fallback();
    }
  }

  const pushSupported = isPushSupported();
  let pushBusy = $state(false);

  // Push needs a browser subscription on top of the server flag: subscribe
  // (asks permission) before enabling, unsubscribe after disabling.
  async function togglePush() {
    if (!auth.user || pushBusy) return;
    notifyError = "";
    pushBusy = true;
    try {
      if (auth.user.notifyPush) {
        await disablePush();
        await updateMe({ notifyPush: false });
      } else {
        const ok = await enablePush();
        if (!ok) {
          notifyError =
            "Notifications refusées ou indisponibles sur cet appareil.";
          return;
        }
        await updateMe({ notifyPush: true });
      }
    } catch (err) {
      notifyError =
        err instanceof ApiError ? err.message : m.common_save_error_fallback();
    } finally {
      pushBusy = false;
    }
  }
</script>

{#if auth.user}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-4 text-lg font-bold">Communications</h2>
    <div class="divide-border divide-y">
      <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
        <div>
          <p class="font-semibold">Email</p>
          <p class="text-dim text-sm">
            Alerte par email quand un épisode suivi sort.
          </p>
        </div>
        <Switch
          label="Notifications par email"
          checked={auth.user.notifyEmail}
          onChange={() => toggleNotify("notifyEmail")} />
      </div>
      <div class="flex items-center justify-between gap-4 py-3">
        <div>
          <p class="font-semibold">Notifications push</p>
          <p class="text-dim text-sm">
            {#if pushSupported}
              Pour être alerté d’un nouvel épisode même appli fermée.
            {:else}
              Non disponible sur cet appareil ou ce navigateur.
            {/if}
          </p>
        </div>
        <Switch
          label="Notifications push"
          checked={auth.user.notifyPush}
          disabled={!pushSupported || pushBusy}
          onChange={togglePush} />
      </div>
      <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
        <div>
          <p class="font-semibold">Newsletter</p>
          <p class="text-dim text-sm">
            Un email à chaque nouvelle version, avec les nouveautés du moment.
          </p>
        </div>
        <Switch
          label="Newsletter des nouveautés"
          checked={auth.user.notifyNewsletter}
          onChange={() => toggleNotify("notifyNewsletter")} />
      </div>
    </div>
    {#if notifyError}
      <p class="text-danger mt-2 text-sm">{notifyError}</p>
    {/if}
  </section>
{/if}
