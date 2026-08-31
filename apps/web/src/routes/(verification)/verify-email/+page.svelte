<script lang="ts">
  import { page } from "$app/state";
  import { verifyEmail } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { m } from "$lib/paraglide/messages.js";

  const token = page.url.searchParams.get("token") ?? "";

  const verifyQuery = createApiQuery(() => ({
    key: keys.verification.email(token),
    fetch: () => verifyEmail(token),
    enabled: !!token,
  }));

  const status = $derived<"pending" | "done" | "error">(
    !token || verifyQuery.error
      ? "error"
      : verifyQuery.loading
        ? "pending"
        : "done",
  );
  const error = $derived(
    !token ? m.link_invalid_missing_token() : verifyQuery.error,
  );
</script>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
  <div class="w-full max-w-sm">
    <div class="mb-8 text-center">
      <p class="font-display text-3xl font-extrabold tracking-tight">
        {m.common_LOOM()}<span class="text-accent">{m.common_KEEP()}</span>
      </p>
    </div>

    <div class="card flex flex-col gap-4 p-7">
      <h1 class="font-display text-xl font-bold">
        {m.auth_verify_email_title()}
      </h1>

      {#if status === "pending"}
        <p class="text-dim text-sm">{m.auth_verify_email_pending()}</p>
      {:else if status === "done"}
        <p class="text-dim text-sm">{m.auth_verify_email_done()}</p>
      {:else}
        <p class="text-danger text-sm">{error}</p>
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
