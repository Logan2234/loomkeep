<script lang="ts">
  import { updateMe } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { auth } from "$lib/auth.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import {
    disablePush,
    enablePush,
    isPushEnabledHere,
    isPushSupported,
  } from "$lib/push";
  import { type AlertKey, DigestCadence } from "@loomkeep/shared";
  import { onMount } from "svelte";
  import SettingRow from "../components/SettingRow.svelte";
  import SettingsSection from "../components/SettingsSection.svelte";
  import AlertGrid from "./AlertGrid.svelte";

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

  const pushCadenceMut = createApiMutation(() => ({
    mutate: (cadence: DigestCadence) => updateMe({ notifyPush: cadence }),
  }));

  function setCadence(
    key: "notifyEmail" | "notifyPush",
    cadence: DigestCadence,
  ) {
    if (!auth.user || cadence === auth.user[key]) return;
    if (cadence === DigestCadence.DAILY && dailyLocked) return;

    if (key === "notifyPush") pushCadenceMut.mutate(cadence);
    else emailCadenceMut.mutate(cadence);
  }

  const pushSupported = isPushSupported();

  // Push is per device (each browser holds its own subscription), while
  // which alerts it carries is per account: this switch only says whether
  // *this* device receives them.
  let pushHere = $state(false);
  onMount(() => {
    void isPushEnabledHere().then((enabled) => (pushHere = enabled));
  });

  // "denied" (no browser permission) isn't an API failure — it's a plain
  // returned outcome, not a throw, so a genuine ApiError from
  // enablePush()/disablePush() (they call subscribePush/getPushPublicKey)
  // still propagates through mutate() normally and resolves via the
  // mutation's own .error instead of being conflated with this one.
  let pushPermissionError = $state<string | null>(null);

  const pushMut = createApiMutation(() => ({
    mutate: async (enabled: boolean): Promise<"ok" | "denied"> => {
      if (!enabled) {
        await disablePush();
        return "ok";
      }
      return (await enablePush()) ? "ok" : "denied";
    },
    onSuccess: (result, enabled) => {
      if (result === "denied") {
        pushPermissionError = m.notifications_push_error();
        return;
      }
      pushHere = enabled;
    },
  }));

  function togglePushHere(enabled: boolean) {
    pushPermissionError = null;
    pushMut.mutate(enabled);
  }

  const newsletterMut = createApiMutation(() => ({
    mutate: (notifyNewsletter: boolean) => updateMe({ notifyNewsletter }),
  }));

  function toggleNewsletter() {
    if (!auth.user) return;
    newsletterMut.mutate(!auth.user.notifyNewsletter);
  }

  // The third value marks a social alert: those only exist while the
  // instance has social features on.
  const ACTIVITY_ALERTS: [AlertKey, string, boolean][] = [
    ["COMMENT_REPLY", m.settings_alert_comment_reply(), true],
    ["COMMENT_MENTION", m.settings_alert_comment_mention(), true],
    ["FOLLOW_REQUEST", m.settings_alert_follow_request(), true],
    ["FOLLOW", m.settings_alert_follow(), true],
    ["FOLLOW_ACCEPTED", m.settings_alert_follow_accepted(), true],
    ["LIST_MEMBER_ADDED", m.settings_alert_list_member_added(), true],
    ["LIST_ITEM_ADDED", m.settings_alert_list_item_added(), true],
    ["INVITATION_ACCEPTED", m.settings_alert_invitation_accepted(), false],
    ["IMPORT_FINISHED", m.settings_alert_import_finished(), false],
    ["COMMENT_REACTIONS", m.settings_alert_comment_reactions(), true],
    ["REVIEW_VOTES", m.settings_alert_review_votes(), true],
  ];

  const activityAlerts = $derived(
    ACTIVITY_ALERTS.filter(
      ([, , social]) => !social || appConfig.socialEnabled,
    ).map(([key, label]) => ({
      key,
      label,
      hint:
        key === "IMPORT_FINISHED"
          ? m.settings_alert_import_finished_hint()
          : undefined,
    })),
  );

  const ADMIN_ALERTS: { key: AlertKey; label: string }[] = [
    {
      key: "ADMIN_REPORTS_PENDING",
      label: m.settings_alert_admin_reports_pending(),
    },
    { key: "ADMIN_JOB_FAILED", label: m.settings_alert_admin_job_failed() },
    { key: "ADMIN_QUOTA", label: m.settings_alert_admin_quota() },
    { key: "ADMIN_NEW_USER", label: m.settings_alert_admin_new_user() },
  ];

  const pushOffHint = $derived(
    pushSupported && !pushHere
      ? m.settings_communications_push_off_hint()
      : null,
  );
</script>

<SettingsSection slug="communications">
  {#if auth.user}
    {@const user = auth.user}
    <div class="space-y-3">
      <section class="card p-5 md:p-6">
        <div class="divide-border divide-y">
          <SettingRow
            anchor="push"
            label={m.common_push_notifications()}
            description={pushSupported
              ? m.settings_communications_push_desc()
              : m.notifications_push_unsupported()}
            mutation={pushMut}
            error={pushPermissionError}>
            {#snippet control()}
              <Switch
                label={m.common_push_notifications()}
                checked={pushHere}
                disabled={!pushSupported || pushMut.loading}
                onChange={togglePushHere} />
            {/snippet}
          </SettingRow>

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
        </div>
      </section>

      <section class="card p-5 md:p-6">
        <p class="font-semibold">
          {m.settings_communications_releases_title()}
        </p>
        <p class="text-dim mt-1 text-sm">
          {m.settings_communications_releases_desc()}
        </p>
        <div class="divide-border mt-2 divide-y">
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
            anchor="push-digest"
            label={m.settings_communications_push()}
            description={m.settings_communications_push_digest_desc()}
            mutation={pushCadenceMut}>
            {#snippet control()}
              <SegmentedControl
                options={cadenceOptions(!pushSupported)}
                value={user.notifyPush}
                onChange={(v) => setCadence("notifyPush", v)} />
            {/snippet}
          </SettingRow>
        </div>
      </section>

      <section class="card p-5 md:p-6">
        <AlertGrid
          anchor="activity-alerts"
          title={m.common_activity()}
          description={m.settings_communications_activity_desc()}
          alerts={activityAlerts}
          columns={["bell", "push"]}
          hint={pushOffHint} />
      </section>

      {#if auth.isAdmin}
        <section class="card p-5 md:p-6">
          <AlertGrid
            anchor="admin-alerts"
            title={m.settings_communications_admin_title()}
            description={m.settings_communications_admin_desc()}
            alerts={ADMIN_ALERTS}
            columns={["email", "push"]}
            hint={pushOffHint} />
        </section>
      {/if}

      <section class="card p-5 md:p-6">
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
        <p class="text-dim mt-3 flex items-start gap-2 text-xs">
          <Icon name="shield" class="mt-px h-4 w-4 shrink-0" />
          {m.settings_communications_security_note()}
        </p>
      </section>
    </div>
  {/if}
</SettingsSection>
