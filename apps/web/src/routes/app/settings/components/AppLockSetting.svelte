<script lang="ts">
  import NewBadge from "#lib/components/NewBadge.svelte";
  import Switch from "#lib/components/Switch.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import {
    appLockStatus,
    isAppLockSupported,
    setAppLock,
    type AppLockStatus,
  } from "#lib/native/app-lock.js";
  import { m } from "#lib/paraglide/messages.js";

  const supported = isAppLockSupported();
  let status = $state<AppLockStatus | null>(null);
  let changing = $state(false);

  $effect(() => {
    if (supported) void appLockStatus().then((current) => (status = current));
  });

  async function toggle(enabled: boolean) {
    changing = true;
    try {
      status = await setAppLock(enabled);
    } finally {
      changing = false;
    }
  }
</script>

{#if supported && status}
  <section class="inset-card mt-3 flex items-center gap-4 p-5 md:p-6">
    <div class="min-w-0 flex-1">
      <p class="flex items-center gap-2 text-sm font-semibold">
        {m.settings_app_lock_label()}
        {#if isFeatureNew("app-lock")}
          <NewBadge />
        {/if}
      </p>
      <p class="text-muted mt-0.5 text-sm">
        {status.available
          ? m.settings_app_lock_desc()
          : m.settings_app_lock_unavailable()}
      </p>
    </div>
    <Switch
      label={m.settings_app_lock_label()}
      checked={status.enabled && status.available}
      disabled={!status.available || changing}
      onChange={toggle} />
  </section>
{/if}
