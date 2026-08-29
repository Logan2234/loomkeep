<script lang="ts">
  import { updateMe } from "$lib/api/client";
  import { resolveApiError } from "$lib/api/errors";
  import { auth } from "$lib/auth.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { liveFlags } from "$lib/feature-flags-live.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { disablePush, enablePush, isPushSupported } from "$lib/push";
  import { DigestCadence } from "@loomkeep/shared";

  let notifyError = $state("");

  const dailyLocked = $derived(
    liveFlags.isEnabled("premium-features") && !auth.isPremium,
  );

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

  async function setTimezone(values: string[]) {
    const timezone = values[0];
    if (!auth.user || !timezone || timezone === auth.user.timezone) return;
    notifyError = "";
    try {
      await updateMe({ timezone });
    } catch (err) {
      notifyError = resolveApiError(err);
    }
  }

  async function setCadence(
    key: "notifyEmail" | "notifyPush",
    cadence: DigestCadence,
  ) {
    if (!auth.user || cadence === auth.user[key]) return;
    if (cadence === DigestCadence.DAILY && dailyLocked) return;
    notifyError = "";

    // Push additionally needs a live browser subscription — mirror the
    // subscribe/unsubscribe dance the boolean toggle used to do.
    if (key === "notifyPush") {
      await togglePushSubscription(cadence);
      return;
    }

    try {
      await updateMe({ [key]: cadence });
    } catch (err) {
      notifyError = resolveApiError(err);
    }
  }

  const pushSupported = isPushSupported();
  let pushBusy = $state(false);

  async function togglePushSubscription(cadence: DigestCadence) {
    if (pushBusy) return;
    pushBusy = true;
    try {
      if (cadence === DigestCadence.DISABLED) {
        await disablePush();
        await updateMe({ notifyPush: cadence });
      } else {
        const ok = await enablePush();
        if (!ok) {
          notifyError = m.settings_communications_push_error();
          return;
        }
        await updateMe({ notifyPush: cadence });
      }
    } catch (err) {
      notifyError = resolveApiError(err);
    } finally {
      pushBusy = false;
    }
  }

  async function toggleNewsletter() {
    if (!auth.user) return;
    notifyError = "";
    try {
      await updateMe({ notifyNewsletter: !auth.user.notifyNewsletter });
    } catch (err) {
      notifyError = resolveApiError(err);
    }
  }
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
            {m.settings_communications_timezone_label()}
          </p>
          <p class="text-dim text-sm">
            {m.settings_communications_timezone_desc()}
          </p>
        </div>
        <Combobox
          label={m.settings_communications_timezone_label()}
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
          <p class="font-semibold">{m.settings_communications_push_label()}</p>
          <p class="text-dim text-sm">
            {#if pushSupported}
              {m.settings_communications_push_desc()}
            {:else}
              {m.settings_communications_push_unsupported()}
            {/if}
          </p>
        </div>
        <SegmentedControl
          options={cadenceOptions(!pushSupported || pushBusy)}
          value={auth.user.notifyPush}
          onChange={(v) => setCadence("notifyPush", v)} />
      </div>
      <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
        <div>
          <p class="flex items-center gap-2 font-semibold">
            {m.settings_communications_newsletter_label()}
            {#if isFeatureNew("newsletter")}
              <NewBadge />
            {/if}
          </p>
          <p class="text-dim text-sm">
            {m.settings_communications_newsletter_desc()}
          </p>
        </div>
        <Switch
          label={m.settings_communications_newsletter_label()}
          checked={auth.user.notifyNewsletter}
          onChange={toggleNewsletter} />
      </div>
    </div>
    {#if notifyError}
      <p class="text-danger mt-2 text-sm">{notifyError}</p>
    {/if}
  </section>
{/if}
