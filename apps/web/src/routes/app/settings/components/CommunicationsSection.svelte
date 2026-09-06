<script lang="ts">
  import { updateMe } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { auth } from "$lib/auth.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
  import { disablePush, enablePush, isPushSupported } from "$lib/push";
  import { DigestCadence } from "@loomkeep/shared";

  const dailyLocked = $derived(auth.isPremiumLocked);

  // A locale change always does a full page reload (see setLocale), so
  // resolving these once at init — rather than re-evaluating m.xxx() per
  // render — is safe and matches how SegmentedControl expects plain strings.
  const CADENCE_LABELS: Record<DigestCadence, string> = {
    [DigestCadence.DISABLED]: m.settings_communications_cadence_disabled(),
    [DigestCadence.WEEKLY]: m.settings_communications_cadence_weekly(),
    [DigestCadence.DAILY]: m.settings_communications_cadence_daily(),
  };

  const cadenceOptions = (disabled: boolean) =>
    [DigestCadence.DISABLED, DigestCadence.WEEKLY, DigestCadence.DAILY].map(
      (value) => ({
        value,
        label: CADENCE_LABELS[value],
        disabled,
        locked: value === DigestCadence.DAILY && dailyLocked,
      }),
    );

  const TIMEZONE_OPTIONS = Intl.supportedValuesOf("timeZone").map((tz) => ({
    label: tz.replaceAll("_", " "),
    value: tz,
  }));

  // One shared error banner at the bottom of the card — starting any of the
  // four actions below resets every other mutation's error, so a stale
  // failure from one control never lingers once another succeeds.
  function resetOtherErrors(except: { reset(): void }) {
    for (const mut of [timezoneMut, emailCadenceMut, pushMut, newsletterMut]) {
      if (mut !== except) mut.reset();
    }
    pushPermissionError = null;
  }

  const timezoneMut = createApiMutation(() => ({
    mutate: (timezone: string) => updateMe({ timezone }),
  }));

  function setTimezone(values: string[]) {
    const timezone = values[0];
    if (!auth.user || !timezone || timezone === auth.user.timezone) return;
    resetOtherErrors(timezoneMut);
    timezoneMut.mutate(timezone);
  }

  const emailCadenceMut = createApiMutation(() => ({
    mutate: (cadence: DigestCadence) => updateMe({ notifyEmail: cadence }),
  }));

  function setCadence(
    key: "notifyEmail" | "notifyPush",
    cadence: DigestCadence,
  ) {
    if (!auth.user || cadence === auth.user[key]) return;
    if (cadence === DigestCadence.DAILY && dailyLocked) return;

    // Push additionally needs a live browser subscription — mirror the
    // subscribe/unsubscribe dance the boolean toggle used to do.
    if (key === "notifyPush") {
      togglePushSubscription(cadence);
      return;
    }

    resetOtherErrors(emailCadenceMut);
    emailCadenceMut.mutate(cadence);
  }

  const pushSupported = isPushSupported();

  // "denied" (no browser permission) isn't an API failure — it's a plain
  // returned outcome, not a throw, so a genuine ApiError from
  // enablePush()/disablePush() (they call subscribePush/getPushPublicKey)
  // still propagates through mutate() normally and resolves via the
  // mutation's own .error instead of being conflated with this one.
  let pushPermissionError = $state<string | null>(null);

  const pushMut = createApiMutation(() => ({
    mutate: async (cadence: DigestCadence): Promise<"ok" | "denied"> => {
      if (cadence === DigestCadence.DISABLED) {
        await disablePush();
      } else {
        const ok = await enablePush();
        if (!ok) return "denied";
      }
      await updateMe({ notifyPush: cadence });
      return "ok";
    },
    onSuccess: (result) => {
      if (result === "denied") {
        pushPermissionError = m.notifications_push_error();
      }
    },
  }));

  function togglePushSubscription(cadence: DigestCadence) {
    resetOtherErrors(pushMut);
    pushMut.mutate(cadence);
  }

  const newsletterMut = createApiMutation(() => ({
    mutate: (notifyNewsletter: boolean) => updateMe({ notifyNewsletter }),
  }));

  function toggleNewsletter() {
    if (!auth.user) return;
    resetOtherErrors(newsletterMut);
    newsletterMut.mutate(!auth.user.notifyNewsletter);
  }

  const notifyError = $derived(
    timezoneMut.error ??
      emailCadenceMut.error ??
      pushPermissionError ??
      pushMut.error ??
      newsletterMut.error,
  );
</script>

{#if auth.user}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-4 flex items-center gap-2 text-lg font-bold">
      {m.settings_section_communications()}
      {#if isFeatureNew("notification-digest")}
        <NewBadge />
      {/if}
    </h2>
    <div class="divide-border divide-y">
      <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
        <div>
          <p class="font-semibold">
            {m.common_timezone()}
          </p>
          <p class="text-dim text-sm">
            {m.settings_communications_timezone_desc()}
          </p>
        </div>
        <Combobox
          label={m.common_timezone()}
          options={TIMEZONE_OPTIONS}
          values={[auth.user.timezone]}
          searchable
          onChange={setTimezone} />
      </div>
      <div class="flex items-center justify-between gap-4 py-3">
        <div>
          <p class="font-semibold">{m.common_email()}</p>
          <p class="text-dim text-sm">
            {m.settings_communications_email_desc()}
          </p>
        </div>
        <SegmentedControl
          options={cadenceOptions(false)}
          value={auth.user.notifyEmail}
          onChange={(v) => setCadence("notifyEmail", v)} />
      </div>
      <div class="flex items-center justify-between gap-4 py-3">
        <div>
          <p class="font-semibold">{m.common_push_notifications()}</p>
          <p class="text-dim text-sm">
            {#if pushSupported}
              {m.settings_communications_push_desc()}
            {:else}
              {m.notifications_push_unsupported()}
            {/if}
          </p>
        </div>
        <SegmentedControl
          options={cadenceOptions(!pushSupported || pushMut.loading)}
          value={auth.user.notifyPush}
          onChange={(v) => setCadence("notifyPush", v)} />
      </div>
      <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
        <div>
          <p class="flex items-center gap-2 font-semibold">
            {m.common_newsletter()}
            {#if isFeatureNew("newsletter")}
              <NewBadge />
            {/if}
          </p>
          <p class="text-dim text-sm">
            {m.settings_communications_newsletter_desc()}
          </p>
        </div>
        <Switch
          label={m.common_newsletter()}
          checked={auth.user.notifyNewsletter}
          onChange={toggleNewsletter} />
      </div>
    </div>
    {#if notifyError}
      <p class="text-danger mt-2 text-sm">{notifyError}</p>
    {/if}
  </section>
{/if}
