<script lang="ts">
  import { ApiError, forgotPassword } from "$lib/api/client";
  import LegalLinks from "$lib/components/LegalLinks.svelte";
  import { m } from "$lib/paraglide/messages.js";

  let email = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);
  let submitted = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    loading = true;
    try {
      await forgotPassword(email);
      submitted = true;
    } catch (err) {
      error =
        err instanceof ApiError
          ? err.message
          : m.auth_forgot_password_error_fallback();
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-screen flex-col">
  <div class="flex flex-1 items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <p class="font-display text-3xl font-extrabold tracking-tight">
          LOOM<span class="text-accent">KEEP</span>
        </p>
        <p class="text-dim mt-2 text-sm">{m.auth_forgot_password_tagline()}</p>
      </div>

      <div class="card flex flex-col gap-4 p-7">
        <h1 class="font-display text-xl font-bold">
          {m.auth_forgot_password_title()}
        </h1>

        {#if !submitted}
          <p class="text-dim text-sm">
            {m.auth_forgot_password_body()}
          </p>
          <form onsubmit={submit} class="flex flex-col gap-4">
            <input
              type="email"
              placeholder={m.auth_register_email_placeholder()}
              bind:value={email}
              required
              class="input" />
            {#if error}<p class="text-danger text-sm">{error}</p>{/if}
            <button type="submit" class="btn btn-primary" disabled={loading}>
              {loading
                ? m.auth_forgot_password_action_loading()
                : m.auth_forgot_password_action()}
            </button>
          </form>
        {:else}
          <p class="text-dim text-sm">
            {m.auth_forgot_password_sent()}
          </p>
        {/if}

        <p class="text-center">
          <a
            href="/login"
            class="btn-text btn-text-underline hover:text-accent text-sm"
            >{m.auth_back_to_login()}</a>
        </p>
      </div>
    </div>
  </div>
  <LegalLinks />
</div>
