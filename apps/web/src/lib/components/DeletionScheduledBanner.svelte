<script lang="ts">
  import { page } from "$app/state";
  import { cancelAccountDeletion } from "#lib/api/client.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { formatDate } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/toast.svelte.js";
  import { slide } from "svelte/transition";

  const reduced = prefersReducedMotion();

  const scheduledFor = $derived(auth.user?.deletionScheduledFor ?? null);
  // The settings page says the same thing in full, with the same buttons.
  const shown = $derived(
    !!scheduledFor && page.url.pathname !== "/app/settings/delete-account",
  );

  const cancelMut = createApiMutation(() => ({
    mutate: cancelAccountDeletion,
    onSuccess: () => {
      if (auth.user) auth.user = { ...auth.user, deletionScheduledFor: null };
      toast.success(m.settings_delete_account_cancelled());
    },
  }));
</script>

{#if shown && scheduledFor}
  <div
    role="status"
    transition:slide={{ duration: reduced ? 0 : 200 }}
    class="border-warning/50 bg-warning/10 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 text-sm">
    <Icon name="hourglass" class="text-warning h-5 w-5 shrink-0" />
    <p class="min-w-0 flex-1 basis-56">
      <span class="font-semibold">
        {m.settings_deletion_banner({ date: formatDate(scheduledFor) })}
      </span>
      {m.settings_deletion_banner_hint()}
    </p>
    <a
      href="/app/settings/export"
      class="link-accent font-semibold transition-colors">
      {m.settings_delete_account_export_link()}
    </a>
    <button
      type="button"
      class="btn btn-primary btn-sm"
      disabled={cancelMut.loading}
      onclick={() => cancelMut.mutate()}>
      {m.settings_delete_account_cancel()}
    </button>
    {#if cancelMut.error}
      <p class="text-danger w-full text-xs">{cancelMut.error}</p>
    {/if}
  </div>
{/if}
