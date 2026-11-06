<script lang="ts">
  import { page } from "$app/state";
  import { verifyEmail } from "#lib/api/client.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { onMount } from "svelte";

  const token = page.url.searchParams.get("token") ?? "";
  let verified = $state(false);

  // A mutation, sent once: the token is single-use, and a query's refetch
  // (tab focus, remount) spent it again and replaced the success with
  // "invalid link".
  const verifyMut = createApiMutation(() => ({
    mutate: verifyEmail,
    onSuccess: () => (verified = true),
  }));
  onMount(() => {
    if (token) verifyMut.mutate(token);
  });

  const status = $derived<"pending" | "done" | "error">(
    verified ? "done" : !token || verifyMut.error ? "error" : "pending",
  );
  const error = $derived(
    !token ? m.link_invalid_missing_token() : verifyMut.error,
  );
</script>

<svelte:head>
  <title>{m.auth_verify_email_title()} · {m.common_loomkeep()}</title>
</svelte:head>

<div class="flex min-h-svh items-center justify-center px-4 py-12">
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
        <a href="/login" class="link-accent text-sm"
          >{m.auth_back_to_login()}</a>
      </p>
    </div>
  </div>
</div>
