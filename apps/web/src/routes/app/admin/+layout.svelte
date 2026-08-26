<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";

  let { children } = $props();

  // Single guard for the whole /admin subtree: the rail hides the entry for
  // non-admins and the API 403s regardless, but a direct navigation must bounce
  // too. Wait for the profile so we don't redirect before auth is known.
  $effect(() => {
    if (auth.user && !auth.isAdmin) void goto("/app");
  });

  // LK-C17: an admin with no MFA method active is shown an explainer instead
  // of the section — not a silent bounce, since they need a clear path to fix
  // it. Real enforcement is server-side (AdminGuard 403s "MFA_REQUIRED"
  // regardless); this is just the UX for that state, not the security
  // boundary. Gated on appConfig.adminMfaEnforced (mirrors the API's own
  // NODE_ENV check) so this screen never blocks access the API would
  // actually allow outside production.
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
    <a href="/app/settings#mfa" class="btn btn-primary">
      {m.admin_mfa_required_cta()}
    </a>
  </div>
{:else if auth.isAdmin}
  {@render children()}

  <a
    href="/app/admin"
    class="border-accent/40 bg-accent/15 text-accent fixed right-4 bottom-20 z-30 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm backdrop-blur md:bottom-4">
    <Icon name="shield" class="h-3.5 w-3.5" />
    {m.common_admin()}
  </a>
{/if}
