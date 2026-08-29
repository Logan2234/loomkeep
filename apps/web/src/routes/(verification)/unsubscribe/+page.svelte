<script lang="ts">
  import { page } from "$app/state";
  import { unsubscribeNewsletter } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { m } from "$lib/paraglide/messages.js";

  const token = page.url.searchParams.get("token") ?? "";

  const unsubscribeQuery = createApiQuery(() => ({
    key: keys.verification.newsletterUnsubscribe(token),
    fetch: () => unsubscribeNewsletter(token),
    enabled: !!token,
  }));

  const status = $derived<"pending" | "done" | "error">(
    !token || unsubscribeQuery.error
      ? "error"
      : unsubscribeQuery.loading
        ? "pending"
        : "done",
  );
  const error = $derived(
    !token ? m.newsletter_unsubscribe_invalid_link() : unsubscribeQuery.error,
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
        {m.newsletter_unsubscribe_title()}
      </h1>

      {#if status === "pending"}
        <p class="text-dim text-sm">{m.newsletter_unsubscribe_pending()}</p>
      {:else if status === "done"}
        <p class="text-dim text-sm">{m.newsletter_unsubscribe_done()}</p>
      {:else}
        <p class="text-danger text-sm">{error}</p>
      {/if}

      <p class="text-dim text-center text-sm">
        <a href="/" class="link-accent">{m.common_loomkeep()}</a>
      </p>
    </div>
  </div>
</div>
