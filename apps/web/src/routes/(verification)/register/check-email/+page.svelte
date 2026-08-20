<script lang="ts">
  import { goto } from "$app/navigation";
  import { ApiError, resendVerificationEmail } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import { m } from "$lib/paraglide/messages.js";

  let status = $state<"idle" | "loading" | "sent" | "error">("idle");
  let error = $state<string | null>(null);
  let pageReady = $state(false);

  let cooldown = $state(0);
  let cooldownTimer: ReturnType<typeof setInterval> | undefined;

  async function resend() {
    if (status === "loading" || cooldown > 0) return;

    status = "loading";
    error = null;

    try {
      await resendVerificationEmail();

      status = "sent";
      cooldown = 60;

      cooldownTimer = setInterval(() => {
        cooldown -= 1;

        if (cooldown <= 0) {
          if (cooldownTimer) clearInterval(cooldownTimer);
          cooldownTimer = undefined;
          status = "idle";
        }
      }, 1000);
    } catch (err) {
      status = "error";
      error =
        err instanceof ApiError
          ? err.message
          : m.auth_register_error_fallback();
    }
  }

  function continueToApp() {
    void goto("/app");
  }

  if (auth.user?.emailVerified) {
    continueToApp();
  } else {
    pageReady = true;
  }
</script>

<svelte:head>
  <title>Vérifiez votre email · {m.common_loomkeep()}</title>
</svelte:head>

{#if pageReady}
  <div class="flex min-h-screen items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <p class="font-display text-3xl font-extrabold tracking-tight">
          LOOM<span class="text-accent">KEEP</span>
        </p>
      </div>

      <div class="card flex flex-col gap-5 p-7">
        <div class="text-center">
          <div
            class="bg-accent/10 text-accent mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
            aria-hidden="true">
            ✓
          </div>

          <h1 class="font-display text-xl font-bold">Vérifiez votre email</h1>

          <p class="text-dim mt-3 text-sm leading-6">
            Votre compte Loomkeep est prêt. Nous vous avons envoyé un email
            contenant un lien pour confirmer votre adresse.
          </p>
        </div>

        {#if status === "sent"}
          <div
            class="border-success/30 bg-success/10 text-success rounded-lg border p-3 text-center text-sm">
            Email envoyé !
          </div>
        {:else if status === "error" && error}
          <p class="text-danger text-center text-sm">
            {error}
          </p>
        {/if}

        <div class="flex flex-col gap-4">
          <button
            type="button"
            class="btn btn-primary btn-primary-cartouche"
            onclick={continueToApp}>
            Continuer vers Loomkeep
          </button>

          <button
            type="button"
            class="btn btn-ghost"
            onclick={resend}
            disabled={status === "loading" || cooldown > 0}>
            {#if status === "loading"}
              Envoi…
            {:else if cooldown > 0}
              Renvoyer dans {cooldown}s
            {:else}
              Renvoyer l'email
            {/if}
          </button>
        </div>

        <p class="text-dim text-center text-xs leading-5">
          Vous ne trouvez pas l'email ? Vérifiez votre dossier spam ou courrier
          indésirable.
        </p>
      </div>
    </div>
  </div>
{/if}
