<script lang="ts">
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import Switch from "#lib/ui/Switch.svelte";
  import {
    appLockStatus,
    isAppLockSupported,
    setAppLock,
    type AppLockStatus,
  } from "#lib/native/app-lock.js";
  import { m } from "#lib/paraglide/messages.js";

  const supported = isAppLockSupported();
  let status = $state<AppLockStatus | null>(null);

  $effect(() => {
    if (supported) void appLockStatus().then((current) => (status = current));
  });

  // A refused change (no biometrics enrolled, the prompt dismissed) used to
  // end as an unhandled rejection, with no message.
  const toggleMut = createApiMutation(() => ({
    mutate: (enabled: boolean) => setAppLock(enabled),
    onSuccess: (next) => (status = next),
    errorToast: true,
  }));
</script>

{#if supported && status}
  <section class="inset-card mt-3 flex items-center gap-4 p-5 md:p-6">
    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold">
        {m.settings_app_lock_label()}
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
      disabled={!status.available || toggleMut.loading}
      onChange={(enabled) => toggleMut.mutate(enabled)} />
  </section>
{/if}
