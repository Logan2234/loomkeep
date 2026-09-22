<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import AdminPageShell from "./AdminPageShell.svelte";

  let { children } = $props();

  $effect(() => {
    if (auth.user && !auth.isAdmin) void goto("/app");
  });

  const mfaBlocked = $derived(
    appConfig.adminMfaEnforced &&
      auth.isAdmin &&
      !auth.user?.mfaTotpEnabled &&
      !auth.user?.mfaEmailEnabled,
  );
</script>

{#if auth.isAdmin && mfaBlocked}
  <div
    class="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
    <Icon name="shield" class="text-warning h-10 w-10" />
    <h1 class="font-display text-xl font-bold">
      {m.admin_mfa_required_title()}
    </h1>
    <p class="text-dim max-w-sm text-sm">{m.admin_mfa_required_desc()}</p>
    <a href="/app/settings/two-factor-authentication" class="btn btn-primary">
      {m.admin_mfa_required_cta()}
    </a>
  </div>
{:else if auth.isAdmin}
  <AdminPageShell pathname={page.url.pathname}>
    {@render children()}
  </AdminPageShell>
{/if}
