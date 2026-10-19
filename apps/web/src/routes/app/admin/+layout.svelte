<script lang="ts">
  import { type LayoutProps } from "./$types";

  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { keys } from "#lib/api/keys.js";
  import { getMfaStatus } from "#lib/api/mfa.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import AdminPageShell from "./AdminPageShell.svelte";

  let { children }: LayoutProps = $props();

  $effect(() => {
    if (auth.user && !auth.isAdmin) void goto("/app");
  });

  // TOTP and email MFA are on the user itself; a security key or passkey
  // (which AdminGuard counts too) is only in the MFA status, fetched just for
  // the accounts that have neither — same cache entry as the 2FA settings.
  const needsKeyCheck = $derived(
    appConfig.adminMfaEnforced &&
      auth.isAdmin &&
      !auth.user?.mfaTotpEnabled &&
      !auth.user?.mfaEmailEnabled,
  );
  const mfaQuery = createApiQuery(() => ({
    key: keys.mfa.status(),
    fetch: getMfaStatus,
    enabled: needsKeyCheck,
  }));
  const mfaBlocked = $derived(
    needsKeyCheck &&
      !!mfaQuery.data &&
      mfaQuery.data.webauthnCredentials.length === 0,
  );
  // Nothing to show while the key check runs: rendering the panel first
  // would only flash it, then its own requests' 403s. If the check itself
  // fails, the panel renders and AdminGuard has the last word.
  const mfaPending = $derived(needsKeyCheck && mfaQuery.loading);
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
{:else if auth.isAdmin && !mfaPending}
  <AdminPageShell pathname={page.url.pathname}>
    {@render children()}
  </AdminPageShell>
{/if}
