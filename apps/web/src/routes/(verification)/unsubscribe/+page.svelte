<script lang="ts">
  import { page } from "$app/stores";
  import { ApiError, unsubscribeNewsletter } from "$lib/api/client";
  import { m } from "$lib/paraglide/messages.js";

  const token = $page.url.searchParams.get("token") ?? "";

  let status = $state<"pending" | "done" | "error">("pending");
  let error = $state<string | null>(null);

  $effect(() => {
    if (!token) {
      status = "error";
      error = m.newsletter_unsubscribe_invalid_link();
      return;
    }

    unsubscribeNewsletter(token)
      .then(() => {
        status = "done";
      })
      .catch((err) => {
        status = "error";
        error =
          err instanceof ApiError
            ? err.message
            : m.newsletter_unsubscribe_error_fallback();
      });
  });
</script>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
  <div class="w-full max-w-sm">
    <div class="mb-8 text-center">
      <p class="font-display text-3xl font-extrabold tracking-tight">
        LOOM<span class="text-accent">KEEP</span>
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
