<script lang="ts">
  import { goto } from "$app/navigation";
  import { resendVerificationEmail } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";

  let pageReady = $state(false);
  let cooldown = $state(0);
  let cooldownTimer: ReturnType<typeof setInterval> | undefined;

  const resendMut = createApiMutation(() => ({
    mutate: resendVerificationEmail,
    onSuccess: () => {
      cooldown = 60;
      clearInterval(cooldownTimer);
      cooldownTimer = setInterval(() => {
        cooldown -= 1;
        if (cooldown <= 0) {
          clearInterval(cooldownTimer);
          cooldownTimer = undefined;
        }
      }, 1000);
    },
  }));

  // "sent" lasts as long as the cooldown; once it expires this reverts to
  // "idle" on its own, matching the resend button re-enabling.
  const status = $derived<"idle" | "loading" | "sent" | "error">(
    resendMut.loading
      ? "loading"
      : resendMut.error
        ? "error"
        : cooldown > 0
          ? "sent"
          : "idle",
  );
  const error = $derived(resendMut.error);

  function resend() {
    if (resendMut.loading || cooldown > 0) return;
    resendMut.mutate();
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
  <title>{m.auth_register_check_email_title()} · {m.common_loomkeep()}</title>
</svelte:head>

{#if pageReady}
  <div class="flex min-h-screen items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <p class="font-display text-3xl font-extrabold tracking-tight">
          {m.common_LOOM()}<span class="text-accent">{m.common_KEEP()}</span>
        </p>
      </div>

      <div class="card flex flex-col gap-5 p-7">
        <div class="text-center">
          <div
            class="bg-accent/10 text-accent mx-auto mb-5 flex items-center justify-center rounded-full">
            <Icon name="check" class="h-14 w-14" />
          </div>

          <h1 class="font-display text-xl font-bold">
            {m.auth_register_check_email_title()}
          </h1>

          <p class="text-dim mt-3 text-sm leading-6">
            {m.auth_register_check_email_body()}
          </p>
        </div>

        {#if status === "sent"}
          <div
            class="border-success/30 bg-success/10 text-success rounded-lg border p-3 text-center text-sm">
            {m.auth_register_check_email_sent()}
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
            {m.auth_register_check_email_continue()}
          </button>

          <button
            type="button"
            class="btn btn-ghost"
            onclick={resend}
            disabled={status === "loading" || cooldown > 0}>
            {#if status === "loading"}
              {m.common_sending()}
            {:else if cooldown > 0}
              {m.common_resend_cooldown({ seconds: cooldown })}
            {:else}
              {m.auth_register_check_email_resend()}
            {/if}
          </button>
        </div>

        <p class="text-dim text-center text-xs leading-5">
          {m.auth_register_check_email_hint()}
        </p>
      </div>
    </div>
  </div>
{/if}
