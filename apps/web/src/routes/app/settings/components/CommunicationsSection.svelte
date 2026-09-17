<script lang="ts">
  import { updateMe } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { auth } from "$lib/auth.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { disablePush, enablePush, isPushSupported } from "$lib/push";
  import { DigestCadence } from "@loomkeep/shared";
  import SettingRow from "./SettingRow.svelte";

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

  const timezoneMut = createApiMutation(() => ({
    mutate: (timezone: string) => updateMe({ timezone }),
  }));

  function setTimezone(values: string[]) {
    const timezone = values[0];
    if (!auth.user || !timezone || timezone === auth.user.timezone) return;
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
    pushPermissionError = null;
    pushMut.mutate(cadence);
  }

  const newsletterMut = createApiMutation(() => ({
    mutate: (notifyNewsletter: boolean) => updateMe({ notifyNewsletter }),
  }));

  function toggleNewsletter() {
    if (!auth.user) return;
    newsletterMut.mutate(!auth.user.notifyNewsletter);
  }
</script>

{#if auth.user}
  {@const user = auth.user}
  <section class="card p-5 md:p-6">
    <div class="divide-border divide-y">
      <SettingRow
        anchor="timezone"
        label={m.common_timezone()}
        description={m.settings_communications_timezone_desc()}
        mutation={timezoneMut}>
        {#snippet control()}
          <Combobox
            label={m.common_timezone()}
            options={TIMEZONE_OPTIONS}
            values={[user.timezone]}
            searchable
            onChange={setTimezone} />
        {/snippet}
      </SettingRow>

      <SettingRow
        anchor="email-digest"
        label={m.common_email()}
        description={m.settings_communications_email_desc()}
        mutation={emailCadenceMut}>
        {#snippet control()}
          <SegmentedControl
            options={cadenceOptions(false)}
            value={user.notifyEmail}
            onChange={(v) => setCadence("notifyEmail", v)} />
        {/snippet}
      </SettingRow>
      <SettingRow
        anchor="push"
        label={m.common_push_notifications()}
        description={pushSupported
          ? m.settings_communications_push_desc()
          : m.notifications_push_unsupported()}
        mutation={pushMut}
        error={pushPermissionError}>
        {#snippet control()}
          <SegmentedControl
            options={cadenceOptions(!pushSupported || pushMut.loading)}
            value={user.notifyPush}
            onChange={(v) => setCadence("notifyPush", v)} />
        {/snippet}
      </SettingRow>

      <SettingRow
        anchor="newsletter"
        label={m.common_newsletter()}
        description={m.settings_communications_newsletter_desc()}
        mutation={newsletterMut}>
        {#snippet control()}
          <Switch
            label={m.common_newsletter()}
            checked={user.notifyNewsletter}
            onChange={toggleNewsletter} />
        {/snippet}
      </SettingRow>
    </div>
  </section>
{/if}
