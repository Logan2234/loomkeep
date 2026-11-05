<script lang="ts">
  import { page } from "$app/state";
  import { cancelAccountDeletionWithToken } from "#lib/api/client.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  const reduced = prefersReducedMotion();
  const token = page.url.searchParams.get("token") ?? "";
  let cancelled = $state(false);

  // A mutation, sent once: the link works a single time, and a query's
  // refetch (tab focus, remount) spent it again and replaced the success with
  // "invalid link".
  const cancelMut = createApiMutation(() => ({
    mutate: cancelAccountDeletionWithToken,
    onSuccess: () => {
      cancelled = true;
      if (auth.user) auth.user = { ...auth.user, deletionScheduledFor: null };
    },
  }));
  onMount(() => {
    if (token) cancelMut.mutate(token);
  });

  const status = $derived<"pending" | "done" | "error">(
    cancelled ? "done" : !token || cancelMut.error ? "error" : "pending",
  );
  const error = $derived(
    !token ? m.link_invalid_missing_token() : cancelMut.error,
  );
</script>

<svelte:head>
  <title>{m.cancel_deletion_title()} · {m.common_loomkeep()}</title>
</svelte:head>

<div class="flex min-h-svh items-center justify-center px-4 py-12">
  <div class="w-full max-w-sm">
    <div class="mb-8 text-center">
      <p class="font-display text-3xl font-extrabold tracking-tight">
        {m.common_LOOM()}<span class="text-accent">{m.common_KEEP()}</span>
      </p>
    </div>

    <div class="card flex flex-col items-start gap-4 p-7">
      {#if status === "pending"}
        <h1 class="font-display text-xl font-bold">
          {m.cancel_deletion_title()}
        </h1>
        <p class="text-dim text-sm">{m.cancel_deletion_pending()}</p>
      {:else if status === "done"}
        <div
          class="flex flex-col items-start gap-4"
          in:fade={{ duration: reduced ? 0 : 200 }}>
          <span
            class="bg-success/12 flex h-11 w-11 items-center justify-center rounded-full">
            <Icon name="check" class="text-success h-5 w-5" />
          </span>
          <h1 class="font-display text-xl font-bold">
            {m.cancel_deletion_done_title()}
          </h1>
          <p class="text-dim text-sm">{m.cancel_deletion_done()}</p>
          <a href={auth.isLoggedIn ? "/app" : "/login"} class="btn btn-primary">
            {auth.isLoggedIn ? m.cancel_deletion_open() : m.common_login()}
          </a>
        </div>
      {:else}
        <h1 class="font-display text-xl font-bold">
          {m.cancel_deletion_title()}
        </h1>
        <p class="text-danger text-sm">{error}</p>
        <a href="/" class="link-accent text-sm">{m.common_loomkeep()}</a>
      {/if}
    </div>
  </div>
</div>
