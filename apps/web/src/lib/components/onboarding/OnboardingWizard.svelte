<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { completeOnboarding, updateMe } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { auth } from "$lib/auth.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { IMPORTS_DEFINITION } from "$lib/constants/import-sources";
  import { THEME_DEFINITIONS } from "$lib/constants/theme-definitions";
  import { toggleDomainSelection } from "$lib/domains";
  import { m } from "$lib/paraglide/messages.js";
  import { getLocale, setLocale } from "$lib/paraglide/runtime.js";
  import { disablePush, enablePush, isPushSupported } from "$lib/push";
  import type { ImportSourceDescriptor } from "$lib/types/import-descriptor";
  import { DigestCadence, Domain, type Locale } from "@loomkeep/shared";
  import Combobox from "../Combobox.svelte";
  import Icon from "../Icon.svelte";
  import Switch from "../Switch.svelte";
  import ThemePreview from "../ThemePreview.svelte";
  import Wizard from "../Wizard.svelte";

  const PICKABLE_DOMAINS = [
    Domain.MEDIA,
    Domain.GAMES,
    Domain.BOOKS,
    Domain.MUSIC,
  ];

  const STEPS = [
    { id: "welcome", label: m.common_welcome() },
    { id: "domains", label: m.common_domains() },
    { id: "settings", label: m.common_settings() },
    { id: "done", label: m.onboarding_step_done() },
  ];

  // Survives the full-page reload that a language change triggers (setLocale
  // navigates/reloads by design — see AppearanceSection) so switching FR/EN
  // mid-wizard doesn't bounce the user back to step 1.
  const STEP_STORAGE_KEY = "loomkeep.onboarding-step";

  function readStoredStep(): number {
    if (!browser) return 0;
    const n = Number(sessionStorage.getItem(STEP_STORAGE_KEY));
    return Number.isInteger(n) && n >= 0 && n < STEPS.length ? n : 0;
  }

  let activeIndex = $state(readStoredStep());

  $effect(() => {
    if (browser) sessionStorage.setItem(STEP_STORAGE_KEY, String(activeIndex));
  });

  const stepId = $derived(STEPS[activeIndex].id);

  const isIphone =
    typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);

  const canAdvance = $derived(
    stepId !== "domains" || (auth.user?.enabledDomains.length ?? 0) > 0,
  );

  // No error UI for these three: a locale/domain/timezone hiccup just leaves
  // the still-current value showing, same call as AppearanceSection/
  // PrivacySection make for the same kind of low-stakes setting.
  const toggleDomainMut = createApiMutation(() => ({
    mutate: (enabledDomains: Domain[]) => updateMe({ enabledDomains }),
  }));

  function toggleDomain(id: Domain) {
    if (!auth.user) return;
    const next = toggleDomainSelection(auth.user.enabledDomains, id);
    if (next === auth.user.enabledDomains) return;
    toggleDomainMut.mutate(next);
  }

  const saveLocaleMut = createApiMutation(() => ({
    mutate: (next: Locale) => updateMe({ locale: next }),
    onSuccess: (_data, next) => setLocale(next),
  }));

  function saveLocale(next: Locale) {
    if (auth.user?.locale === next) return;
    saveLocaleMut.mutate(next);
  }

  const setTimezoneMut = createApiMutation(() => ({
    mutate: (timezone: string) => updateMe({ timezone }),
  }));

  // One shared error banner — starting any of the three notification
  // toggles resets the others', so a stale failure never lingers once
  // another succeeds (same pattern as CommunicationsSection).
  function resetOtherErrors(except: { reset(): void }) {
    for (const mut of [newsletterMut, emailDigestMut, pushMut]) {
      if (mut !== except) mut.reset();
    }
  }

  const newsletterMut = createApiMutation(() => ({
    mutate: (notifyNewsletter: boolean) => updateMe({ notifyNewsletter }),
  }));

  function toggleNewsletter() {
    if (!auth.user) return;
    resetOtherErrors(newsletterMut);
    newsletterMut.mutate(!auth.user.notifyNewsletter);
  }

  // No premium upsell at onboarding: a simple on/off, mapped onto the
  // (now cadence-based) preference. WEEKLY is the free default — see
  // Settings > Communications for the full daily/weekly/off picker.
  const emailDigestMut = createApiMutation(() => ({
    mutate: (notifyEmail: DigestCadence) => updateMe({ notifyEmail }),
  }));

  function toggleEmailDigest() {
    if (!auth.user) return;
    resetOtherErrors(emailDigestMut);
    emailDigestMut.mutate(
      auth.user.notifyEmail === DigestCadence.DISABLED
        ? DigestCadence.WEEKLY
        : DigestCadence.DISABLED,
    );
  }

  const pushSupported = isPushSupported();

  // "denied" (no browser permission) isn't an API failure — see
  // CommunicationsSection's togglePushSubscription for why it's returned
  // as data rather than thrown.
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

  function togglePush() {
    resetOtherErrors(pushMut);
    pushPermissionError = null;
    pushMut.mutate(
      auth.user?.notifyPush !== DigestCadence.DISABLED
        ? DigestCadence.DISABLED
        : DigestCadence.WEEKLY,
    );
  }

  const notifyError = $derived(
    pushPermissionError ??
      newsletterMut.error ??
      emailDigestMut.error ??
      pushMut.error,
  );

  const TIMEZONE_OPTIONS = Intl.supportedValuesOf("timeZone").map((tz) => ({
    label: tz.replaceAll("_", " "),
    value: tz,
  }));

  // Auto-detected once, the first time the "settings" step is shown — still
  // freely editable afterwards (here and later in Settings).
  let timezoneDetected = false;
  $effect(() => {
    if (stepId === "settings" && !timezoneDetected && auth.user) {
      timezoneDetected = true;
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && detected !== auth.user.timezone) {
        setTimezoneMut.mutate(detected);
      }
    }
  });

  function setTimezone(values: string[]) {
    const timezone = values[0];
    if (!auth.user || !timezone || timezone === auth.user.timezone) return;
    setTimezoneMut.mutate(timezone);
  }

  const importSources = $derived(
    (() => {
      const map = new Map<Domain, ImportSourceDescriptor[]>();

      for (const importSourceDescriptor of Object.values(IMPORTS_DEFINITION)) {
        if (
          importSourceDescriptor.href &&
          auth.user?.enabledDomains.includes(importSourceDescriptor.domain)
        ) {
          if (!map.has(importSourceDescriptor.domain)) {
            map.set(importSourceDescriptor.domain, []);
          }

          map.get(importSourceDescriptor.domain)?.push(importSourceDescriptor);
        }
      }

      return map;
    })(),
  );

  const additionalAction = $derived(
    stepId === "done" && importSources.size > 0
      ? {
          label: m.onboarding_done_import_cta(),
          onClick: async () => {
            await finish();
            await goto("/app/settings/import");
          },
        }
      : undefined,
  );

  async function finish() {
    await completeOnboarding();
    if (browser) sessionStorage.removeItem(STEP_STORAGE_KEY);
  }
</script>

<Wizard
  steps={STEPS}
  {activeIndex}
  {canAdvance}
  {additionalAction}
  onBack={() => activeIndex--}
  onNext={() => activeIndex++}
  onJump={(i) => (activeIndex = i)}
  onFinish={finish}
  class="-mt-3">
  {#if stepId === "welcome"}
    <h2 class="font-display mb-3 text-xl font-bold">
      {m.onboarding_welcome_title()}
    </h2>
    <p class="text-dim mb-4 text-sm">{m.onboarding_welcome_intro()}</p>
    <ul class="marker:text-accent mb-4 list-disc space-y-2 pl-5 text-sm">
      <li>{m.onboarding_welcome_feature_progress()}</li>
      <li>{m.onboarding_welcome_feature_lists()}</li>
      <li>{m.onboarding_welcome_feature_stats()}</li>
      {#if appConfig.socialEnabled}
        <li>{m.onboarding_welcome_feature_social()}</li>
      {/if}
    </ul>
    <p class="text-dim mb-4 text-sm">{m.onboarding_welcome_young_project()}</p>
    <p class="timecode border-accent border-l-2 pl-3 text-xs">
      {m.onboarding_welcome_help_hint()}
    </p>
  {:else if stepId === "domains"}
    <h2 class="font-display mb-3 text-xl font-bold">
      {m.onboarding_domains_title()}
    </h2>
    <p class="text-dim mb-4 text-sm">{m.onboarding_domains_intro()}</p>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {#each PICKABLE_DOMAINS as id (id)}
        {@const on = auth.user?.enabledDomains.includes(id) ?? false}
        <button
          type="button"
          class="border-border relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors {on
            ? 'border-accent bg-accent/10 text-fg'
            : 'text-dim hover:bg-surface-2'}"
          onclick={() => toggleDomain(id)}>
          <Icon
            name={DOMAINS[id].icon}
            class="h-5 w-5 {on ? 'text-accent' : ''}" />
          <span class="text-xs font-semibold">{DOMAINS[id].label}</span>
        </button>
      {/each}
    </div>
  {:else if stepId === "settings"}
    <h2 class="font-display mb-3 text-xl font-bold">
      {m.common_settings()}
    </h2>
    <p class="text-dim mb-4 text-sm">{m.onboarding_settings_intro()}</p>

    <div class="mb-5">
      <p class="mb-2 text-sm font-semibold">{m.common_theme()}</p>
      <div class="flex gap-2">
        {#each THEME_DEFINITIONS as theme (theme.mode)}
          <ThemePreview {theme} />
        {/each}
      </div>
    </div>

    <div class="mb-5">
      <p class="mb-2 text-sm font-semibold">{m.common_language()}</p>
      <div class="flex gap-2">
        <button
          type="button"
          class="chip"
          class:chip-on={(auth.user?.locale ?? getLocale()) === "fr"}
          onclick={() => saveLocale("fr")}>
          {m.common_language_fr()}
        </button>
        <button
          type="button"
          class="chip"
          class:chip-on={(auth.user?.locale ?? getLocale()) === "en"}
          onclick={() => saveLocale("en")}>
          {m.common_language_en()}
        </button>
      </div>
    </div>

    <div class="divide-border divide-y">
      <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
        <div>
          <p class="text-sm font-semibold">
            {m.common_timezone()}
          </p>
          <p class="text-dim text-xs">
            {m.onboarding_settings_timezone_desc()}
          </p>
        </div>
        <Combobox
          label={m.common_timezone()}
          options={TIMEZONE_OPTIONS}
          values={[auth.user?.timezone ?? "Europe/Paris"]}
          searchable
          onChange={setTimezone} />
      </div>
      <div class="flex items-center justify-between gap-4 py-3">
        <div>
          <p class="text-sm font-semibold">
            {m.common_push_notifications()}
          </p>
          <p class="text-dim text-xs">
            {#if !pushSupported}
              {m.notifications_push_unsupported()}
            {:else if isIphone}
              {m.onboarding_settings_push_desc_iphone()}
            {:else}
              {m.onboarding_settings_push_desc()}
            {/if}
          </p>
        </div>
        <Switch
          label={m.common_push_notifications()}
          checked={(auth.user?.notifyPush ?? DigestCadence.DISABLED) !==
            DigestCadence.DISABLED}
          disabled={!pushSupported || pushMut.loading}
          onChange={togglePush} />
      </div>
      <div class="flex items-center justify-between gap-4 py-3">
        <div>
          <p class="text-sm font-semibold">
            {m.onboarding_settings_email_label()}
          </p>
          <p class="text-dim text-xs">{m.onboarding_settings_email_desc()}</p>
        </div>
        <Switch
          label={m.onboarding_settings_email_label()}
          checked={(auth.user?.notifyEmail ?? DigestCadence.DISABLED) !==
            DigestCadence.DISABLED}
          onChange={toggleEmailDigest} />
      </div>
      <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
        <div>
          <p class="text-sm font-semibold">
            {m.common_newsletter()}
          </p>
          <p class="text-dim text-xs">
            {m.onboarding_settings_newsletter_desc()}
          </p>
        </div>
        <Switch
          label={m.common_newsletter()}
          checked={auth.user?.notifyNewsletter ?? false}
          onChange={toggleNewsletter} />
      </div>
    </div>

    {#if notifyError}
      <p class="text-danger mt-2 text-sm">{notifyError}</p>
    {/if}
  {:else}
    <h2 class="font-display mb-3 text-xl font-bold">
      {m.onboarding_done_title()}
    </h2>
    <p class="text-dim mb-4 text-sm">{m.onboarding_done_intro()}</p>

    {#if importSources.size > 0}
      <p class="mb-2 text-sm font-semibold">
        {m.onboarding_done_import_title()}
      </p>
      <ul class="space-y-1.5 text-sm">
        {#each importSources as [domainSlug, descriptors] (domainSlug)}
          <li class="border-border rounded-lg border px-3 py-2">
            {domainSlug === Domain.MEDIA
              ? m.onboarding_done_import_domain_media()
              : DOMAINS[domainSlug].label} — {m.onboarding_done_import_via({
              source: descriptors.map((d) => d.label).join(", "),
            })}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</Wizard>
