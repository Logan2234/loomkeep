<script lang="ts">
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { invalidate } from "#lib/api/invalidations.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Modal from "#lib/ui/Modal.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/ui/toast-store.svelte.js";
  import type { QueryKey } from "@tanstack/svelte-query";
  import type { Snippet } from "svelte";

  // The shell shared by every personal feed (calendar, activity, Radarr and
  // Sonarr): the links drawn by `children` from the token, and one
  // "Regenerate" at the bottom, since it revokes all of them at once.
  let {
    title,
    tokenKey,
    getToken,
    regenerateToken,
    confirm,
    privacy,
    onclose,
    children,
  }: {
    title: string;
    tokenKey: QueryKey;
    getToken: () => Promise<{ token: string }>;
    regenerateToken: () => Promise<{ token: string }>;
    confirm: string;
    privacy: string;
    onclose: () => void;
    children: Snippet<[string]>;
  } = $props();

  const tokenQuery = createApiQuery(() => ({
    key: tokenKey,
    fetch: getToken,
  }));
  const token = $derived(tokenQuery.data?.token ?? null);

  let confirming = $state(false);
  const regenerateMut = createApiMutation(() => ({
    mutate: regenerateToken,
    invalidates: invalidate.shown(tokenKey),
    onSuccess: () => {
      confirming = false;
      toast.success(m.subscription_link_regenerated());
    },
  }));
</script>

<Modal {title} {onclose}>
  {#if tokenQuery.loading}
    <p class="text-dim text-sm">{m.calendar_link_generating()}</p>
  {:else if tokenQuery.error || !token}
    <p class="text-danger text-sm">{tokenQuery.error}</p>
  {:else if confirming}
    <p class="text-dim text-sm">{confirm}</p>
    {#if regenerateMut.error}
      <p class="text-danger mt-2 text-sm">{regenerateMut.error}</p>
    {/if}
    <div class="mt-5 flex justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        disabled={regenerateMut.loading}
        onclick={() => (confirming = false)}>
        {m.common_cancel()}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        disabled={regenerateMut.loading}
        onclick={() => regenerateMut.mutate()}>
        {regenerateMut.loading
          ? m.common_regenerating()
          : m.common_regenerate()}
      </button>
    </div>
  {:else}
    {@render children(token)}
    <div
      class="border-border mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-4">
      <p class="text-dim min-w-0 flex-1 basis-56 text-xs">{privacy}</p>
      <button
        type="button"
        class="text-accent shrink-0 text-sm font-semibold"
        onclick={() => (confirming = true)}>
        {m.calendar_link_regenerate()}
      </button>
    </div>
  {/if}
</Modal>
