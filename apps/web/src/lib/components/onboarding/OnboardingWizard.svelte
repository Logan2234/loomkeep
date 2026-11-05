<script lang="ts">
  import {
    STORAGE_KEYS,
    LEGACY_STORAGE_KEYS,
  } from "#lib/constants/storage-keys.js";

  import {
    readSessionStorage,
    writeSessionStorage,
    removeSessionStorage,
  } from "#lib/local-storage.js";

  import { browser } from "$app/env";
  import { goto } from "$app/navigation";
  import {
    completeOnboarding,
    getShowcase,
    getWatchProviderCatalog,
    updateMe,
  } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { updatePrivacySettings } from "#lib/api/social.js";
  import { auth } from "#lib/auth.svelte.js";
  import { appConfig } from "#lib/config.svelte.js";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { THEME_DEFINITIONS } from "#lib/constants/theme-definitions.js";
  import { createDomainToggle } from "#lib/domain-toggle.svelte.js";
  import { formatDate, formatRegion } from "#lib/format.js";
  import { useOnboardingChecklist } from "#lib/gamification/onboarding-checklist.svelte.js";
  import { layout } from "#lib/layout.svelte.js";
  import { languageName } from "#lib/locales.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { isNativeApp } from "#lib/native/app-shell.js";
  import { tapFeedback } from "#lib/native/haptics.js";
  import { onboardingReplay } from "#lib/onboarding-replay.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale } from "#lib/paraglide/runtime.js";
  import { ACCESS } from "#lib/privacy-options.js";
  import { disablePush, enablePush, isPushSupported } from "#lib/push.js";
  import { createWatchProviderToggle } from "#lib/watch-provider-toggle.svelte.js";
  import type { IconName } from "#lib/types/icon-name.js";
  import {
    DigestCadence,
    Domain,
    ProfileAccess,
    USER_LIMITS,
  } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { backOut } from "svelte/easing";
  import { scale } from "svelte/transition";
  import Avatar from "../Avatar.svelte";
  import BrandMark from "../BrandMark.svelte";
  import EditAvatarModal from "../EditAvatarModal.svelte";
  import Icon from "../Icon.svelte";
  import SegmentedControl from "../SegmentedControl.svelte";
  import Switch from "../Switch.svelte";
  import ThemePreview from "../ThemePreview.svelte";
  import Wizard from "../Wizard.svelte";
  import { deriveStepViews, stepLabel } from "./onboarding-checklist";

  const PICKABLE_DOMAINS: { id: Domain; example: () => string }[] = [
    { id: Domain.MEDIA, example: m.onboarding_domain_media_example },
    { id: Domain.GAMES, example: m.onboarding_domain_games_example },
    { id: Domain.BOOKS, example: m.onboarding_domain_books_example },
    { id: Domain.MUSIC, example: m.common_albums },
  ];

  const STEPS = [
    { id: "welcome", label: m.common_welcome() },
    { id: "domains", label: m.common_domains() },
    { id: "profile", label: m.onboarding_step_profile() },
    { id: "settings", label: m.common_settings() },
    { id: "done", label: m.onboarding_step_done() },
  ];

  // Survives the full-page reload that a language change triggers (setLocale
  // navigates/reloads by design — see AppearanceSection) so switching FR/EN
  // mid-wizard doesn't bounce the user back to step 1.
  const STEP_STORAGE_KEY = STORAGE_KEYS.onboardingStep;

  function readStoredStep(): number {
    if (!browser) return 0;
    const n = Number(
      readSessionStorage(STEP_STORAGE_KEY, LEGACY_STORAGE_KEYS.onboardingStep),
    );
    return Number.isInteger(n) && n >= 0 && n < STEPS.length ? n : 0;
  }

  let activeIndex = $state(readStoredStep());

  $effect(() => {
    if (browser) writeSessionStorage(STEP_STORAGE_KEY, String(activeIndex));
  });

  const stepId = $derived(STEPS[activeIndex].id);
  const reduced = prefersReducedMotion();
  const queryClient = useQueryClient();

  const canAdvance = $derived(
    stepId !== "domains" || (auth.user?.enabledDomains.length ?? 0) > 0,
  );

  const pickedCount = $derived(auth.user?.enabledDomains.length ?? 0);

  const hint = $derived.by(() => {
    switch (stepId) {
      case "welcome":
        return layout.compact
          ? m.onboarding_hint_swipe()
          : m.onboarding_hint_keys();
      case "domains":
        if (pickedCount === 0) return m.onboarding_domains_none();
        return pickedCount > 1
          ? m.onboarding_domains_count_many({ count: pickedCount })
          : m.onboarding_domains_count_one();
      case "profile":
        return m.common_optional();
      case "settings":
        return m.onboarding_settings_later();
      default:
        return undefined;
    }
  });

  const nextLabel = $derived(
    stepId === "welcome"
      ? m.onboarding_start()
      : stepId === "done"
        ? m.onboarding_done_open()
        : undefined,
  );

  // ── Welcome ─────────────────────────────────────────────────────────────

  // The sign-in wall's covers when the instance can name some, warm
  // projector hues until then.
  const showcase = createApiQuery(() => ({
    key: keys.showcase(),
    fetch: getShowcase,
    retry: 0,
  }));
  const WALL_SIZE = 25;
  const HUES = [32, 200, 330, 150, 265, 12, 185, 48, 290, 110];
  const wall = $derived.by(() => {
    const covers = showcase.data?.posters ?? [];
    return Array.from({ length: WALL_SIZE }, (_, i) =>
      covers.length >= 8
        ? { src: covers[i % covers.length], bg: null }
        : {
            src: null,
            bg: `linear-gradient(165deg, hsl(${HUES[i % HUES.length]} 45% 40%), hsl(${(HUES[i % HUES.length] + 35) % 360} 50% 13%))`,
          },
    );
  });

  const FEATURES = $derived(
    [
      {
        icon: "check" as IconName,
        title: m.onboarding_welcome_progress_title(),
        body: m.onboarding_welcome_progress_body(),
      },
      {
        icon: "calendar" as IconName,
        title: m.onboarding_welcome_releases_title(),
        body: m.onboarding_welcome_releases_body(),
      },
      {
        icon: "trophy" as IconName,
        title: m.onboarding_welcome_xp_title(),
        body: m.onboarding_welcome_xp_body(),
      },
      appConfig.socialEnabled && {
        icon: "message" as IconName,
        title: m.onboarding_welcome_friends_title(),
        body: m.onboarding_welcome_friends_body(),
      },
      {
        icon: "download" as IconName,
        title: m.onboarding_welcome_import_title(),
        body: m.onboarding_welcome_import_body(),
      },
      !layout.compact &&
        !isNativeApp() && {
          icon: "smartphone" as IconName,
          title: m.onboarding_welcome_android_title(),
          body: m.onboarding_welcome_android_body(),
        },
    ].filter((feature) => !!feature),
  );

  // ── Domains ─────────────────────────────────────────────────────────────

  // No error UI for the domains, timezone or theme: a hiccup just leaves the
  // still-current value showing, same call as AppearanceSection/
  // PrivacySection make for the same kind of low-stakes setting.
  const domainToggle = createDomainToggle();

  function toggleDomain(id: Domain) {
    tapFeedback();
    domainToggle.toggle(id);
  }

  // ── Profile ─────────────────────────────────────────────────────────────

  let displayName = $state(auth.user?.displayName ?? "");
  let avatarModalOpen = $state(false);

  const displayNameMut = createApiMutation(() => ({
    mutate: (next: string) => updateMe({ displayName: next }),
    errorToast: true,
  }));

  function saveDisplayName() {
    const next = displayName.trim();
    if (!auth.user || !next || next === auth.user.displayName) return;
    displayNameMut.mutate(next);
  }

  // A brand-new account has no followers or lists to hide, so the wizard
  // offers only the two everyday modes; Figurant stays in Settings › Privacy,
  // behind its confirmation.
  const ONBOARDING_ACCESS = ACCESS.filter((a) => a.id !== ProfileAccess.GHOST);
  const profileAccess = $derived(auth.user?.profileAccess);

  const accessMut = createApiMutation(() => ({
    mutate: (profileAccess: ProfileAccess) =>
      updatePrivacySettings({ profileAccess }),
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.privacy.settings(), updated);
      if (auth.user) auth.user.profileAccess = updated.profileAccess;
    },
    errorToast: true,
  }));

  function setAccess(next: ProfileAccess) {
    if (next === profileAccess || accessMut.loading) return;
    accessMut.mutate(next);
  }

  // ── Settings ────────────────────────────────────────────────────────────

  const setTimezoneMut = createApiMutation(() => ({
    mutate: (timezone: string) => updateMe({ timezone }),
  }));

  // Taken from the device once, silently; changed later in Settings.
  let timezoneDetected = false;
  $effect(() => {
    if (timezoneDetected || !auth.user) return;
    timezoneDetected = true;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && detected !== auth.user.timezone) {
      setTimezoneMut.mutate(detected);
    }
  });

  const SERVICES_SHOWN = 8;
  const showServices = $derived(
    auth.user?.enabledDomains.includes(Domain.MEDIA) ?? false,
  );
  const watchRegion = $derived(auth.user?.watchRegion ?? null);
  const catalogQuery = createApiQuery(() => ({
    key: keys.catalog.watchProviders(watchRegion),
    fetch: () => getWatchProviderCatalog(watchRegion ?? undefined),
    enabled: showServices,
  }));
  const providerPicker = createWatchProviderToggle();
  const myProviders = $derived(new Set(auth.user?.watchProviderIds ?? []));
  const services = $derived(
    (catalogQuery.data?.providers ?? []).filter(
      (p, index) => index < SERVICES_SHOWN || myProviders.has(p.id),
    ),
  );

  function toggleService(id: number) {
    tapFeedback();
    providerPicker.toggle(id);
  }

  // One shared error line — starting any of the three notification
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
  const isIphone =
    typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);
  const onPhone = isNativeApp();

  // Turning push on is what asks the device for its permission; the row then
  // says how that went.
  let pushOutcome = $state<"granted" | "denied" | null>(null);

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
    onSuccess: (result, cadence) => {
      if (result === "denied") pushOutcome = "denied";
      else if (cadence !== DigestCadence.DISABLED) pushOutcome = "granted";
    },
  }));

  // A new account's push preference defaults to on, but a browser that was
  // never asked can't deliver anything: the switch starts off there.
  const browserAllows =
    onPhone ||
    (typeof Notification !== "undefined" &&
      Notification.permission === "granted");
  const pushOn = $derived(
    (auth.user?.notifyPush ?? DigestCadence.DISABLED) !==
      DigestCadence.DISABLED &&
      pushOutcome !== "denied" &&
      (pushOutcome === "granted" || browserAllows),
  );

  function togglePush() {
    resetOtherErrors(pushMut);
    pushOutcome = null;
    pushMut.mutate(pushOn ? DigestCadence.DISABLED : DigestCadence.WEEKLY);
  }

  const pushDescription = $derived.by(() => {
    if (!pushSupported) return m.notifications_push_unsupported();
    if (isIphone && !onPhone) return m.onboarding_settings_push_desc_iphone();
    if (pushOutcome === "denied")
      return onPhone
        ? m.onboarding_settings_push_denied_phone()
        : m.onboarding_settings_push_denied_browser();
    if (pushOn) return m.onboarding_settings_push_granted();
    return onPhone
      ? m.onboarding_settings_push_ask_phone()
      : m.onboarding_settings_push_ask_browser();
  });

  const notifyError = $derived(
    newsletterMut.error ?? emailDigestMut.error ?? pushMut.error,
  );

  // ── Done ────────────────────────────────────────────────────────────────

  const checklistQuery = useOnboardingChecklist();
  const firstSteps = $derived(
    checklistQuery.data
      ? deriveStepViews(checklistQuery.data.steps).slice(0, 3)
      : [],
  );

  const pickedDomains = $derived(
    PICKABLE_DOMAINS.filter(({ id }) => auth.user?.enabledDomains.includes(id)),
  );

  const facts = $derived.by(() => {
    const list: string[] = [];
    const serviceCount = auth.user?.watchProviderIds.length ?? 0;
    if (showServices && serviceCount > 0)
      list.push(
        serviceCount > 1
          ? m.onboarding_done_services_many({ count: serviceCount })
          : m.onboarding_done_services_one(),
      );
    list.push(
      pushOn
        ? m.onboarding_done_alerts_push()
        : auth.user?.notifyEmail !== DigestCadence.DISABLED
          ? m.onboarding_done_alerts_email()
          : m.onboarding_done_alerts_none(),
    );
    if (appConfig.socialEnabled && profileAccess)
      list.push(
        profileAccess === ProfileAccess.PUBLIC
          ? m.onboarding_done_profile_public()
          : m.onboarding_done_profile_private(),
      );
    return list;
  });

  const additionalAction = $derived(
    stepId === "profile"
      ? { label: m.onboarding_later(), onClick: () => activeIndex++ }
      : stepId === "done"
        ? {
            label: m.onboarding_done_import_cta(),
            onClick: async () => {
              await finish();
              await goto("/app/settings/import");
            },
          }
        : undefined,
  );

  function next() {
    if (stepId === "profile") saveDisplayName();
    activeIndex++;
  }

  async function finish() {
    if (onboardingReplay.active) onboardingReplay.active = false;
    else await completeOnboarding();
    if (browser) removeSessionStorage(STEP_STORAGE_KEY);
  }
</script>

{#snippet brand()}
  <p
    class="font-display mb-10 ml-2.5 flex items-center gap-2 text-xl font-extrabold tracking-tight">
    <BrandMark class="h-6 w-6" />
    <span
      >{m.common_LOOM()}<span class="text-accent">{m.common_KEEP()}</span
      ></span>
  </p>
{/snippet}

{#snippet youngProject()}
  <p
    class="border-border text-dim rounded-xl border border-dashed px-3.5 py-3 text-sm leading-relaxed md:border-0 md:px-2.5 md:py-0">
    {m.onboarding_welcome_young()}
  </p>
{/snippet}

{#snippet closeReplay()}
  {#if onboardingReplay.active}
    <button
      type="button"
      class="btn-icon h-11 w-11 rounded-full"
      aria-label={m.common_close()}
      onclick={() => {
        onboardingReplay.active = false;
        if (browser) removeSessionStorage(STEP_STORAGE_KEY);
      }}>
      <Icon name="x" class="h-5 w-5" />
    </button>
  {/if}
{/snippet}

{#snippet title(text: string, lead: string)}
  <h2
    class="font-display mb-2.5 text-[1.875rem] leading-[1.05] font-extrabold tracking-tight md:mb-3 md:text-5xl">
    {text}
  </h2>
  <p
    class="text-dim mb-6 max-w-xl text-[0.95rem] leading-relaxed md:mb-8 md:text-lg">
    {lead}
  </p>
{/snippet}

<Wizard
  steps={STEPS}
  {activeIndex}
  {canAdvance}
  {additionalAction}
  {hint}
  {nextLabel}
  fullscreen
  asideHeader={brand}
  aside={youngProject}
  topAction={closeReplay}
  onBack={() => activeIndex--}
  onNext={next}
  onJump={(i) => (activeIndex = i)}
  onFinish={finish}>
  {#if stepId === "welcome"}
    <div class="lg:grid lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:gap-12">
      <div>
        <div
          class="relative -mx-5 -mt-3 mb-5 h-44 overflow-hidden lg:hidden"
          aria-hidden="true">
          {@render posterWall("grid-cols-7 gap-2 [&>*]:h-24")}
          <p
            class="font-display absolute bottom-1.5 left-5 z-10 flex items-center gap-2 text-lg font-extrabold">
            <BrandMark class="h-5 w-5" />
            <span
              >{m.common_LOOM()}<span class="text-accent"
                >{m.common_KEEP()}</span
              ></span>
          </p>
        </div>
        {@render title(
          m.onboarding_welcome_title({ name: auth.user?.displayName ?? "" }),
          m.onboarding_welcome_intro(),
        )}
        <ul
          class="mb-5 flex flex-col md:grid md:grid-cols-2 md:gap-x-7 md:gap-y-6">
          {#each FEATURES as feature (feature.title)}
            <li class="flex gap-3.5 py-2.5 md:flex-col md:gap-2 md:py-0">
              <span
                class="bg-accent/13 text-accent grid h-9.5 w-9.5 shrink-0 place-items-center rounded-[11px]">
                <Icon name={feature.icon} class="h-5 w-5" />
              </span>
              <div>
                <p class="mt-0.5 mb-0.5 font-bold">{feature.title}</p>
                <p class="text-dim text-sm leading-snug">{feature.body}</p>
              </div>
            </li>
          {/each}
        </ul>
        <div class="md:hidden">{@render youngProject()}</div>
      </div>
      <div
        class="relative hidden overflow-hidden rounded-2xl lg:block"
        aria-hidden="true">
        {@render posterWall("grid-cols-5 gap-3 [&>*]:h-40")}
      </div>
    </div>
  {:else if stepId === "domains"}
    {@render title(m.onboarding_domains_title(), m.onboarding_domains_intro())}
    <div class="grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {#each PICKABLE_DOMAINS as { id, example } (id)}
        {@const on = auth.user?.enabledDomains.includes(id) ?? false}
        {@const accent = DOMAINS[id].accent}
        <button
          type="button"
          aria-pressed={on}
          class="bg-surface relative flex h-39 flex-col justify-end gap-1 rounded-[18px] border-[1.5px] p-4 text-left transition-[border-color,background-color,translate,scale] duration-150 ease-out active:scale-[0.97] md:h-56 md:p-5 md:hover:-translate-y-0.5 {on
            ? ''
            : 'border-border'}"
          style:border-color={on ? accent : undefined}
          style:background-color={on
            ? `color-mix(in srgb, ${accent} 12%, var(--color-surface))`
            : undefined}
          onclick={() => toggleDomain(id)}>
          <span
            class="absolute top-4 left-4 grid h-11 w-11 place-items-center rounded-xl md:top-5 md:left-5 md:h-13 md:w-13"
            style:color={accent}
            style:background-color={`color-mix(in srgb, ${accent} 16%, transparent)`}>
            <Icon name={DOMAINS[id].icon} class="h-6 w-6" />
          </span>
          <span
            class="border-border absolute top-3.5 right-3.5 grid h-6 w-6 place-items-center rounded-full border-[1.5px] transition-colors duration-150 md:top-5 md:right-5"
            style:background-color={on ? accent : undefined}
            style:border-color={on ? accent : undefined}>
            {#if on}
              <span
                in:scale={{
                  start: 0.4,
                  duration: reduced ? 0 : 200,
                  easing: backOut,
                }}>
                <Icon name="check" class="h-3.5 w-3.5 text-white" />
              </span>
            {/if}
          </span>
          <span class="font-display text-xl font-extrabold md:text-2xl">
            {DOMAINS[id].label}
          </span>
          <span class="text-dim text-xs md:text-sm">{example()}</span>
        </button>
      {/each}
    </div>
  {:else if stepId === "profile"}
    {@render title(m.onboarding_profile_title(), m.onboarding_profile_intro())}
    <div
      class="flex flex-col md:grid md:max-w-3xl md:grid-cols-[10.5rem_minmax(0,1fr)] md:items-start md:gap-12">
      <div class="mb-6 flex flex-col items-center gap-2.5 md:mb-0">
        <button
          type="button"
          class="relative rounded-full transition-transform duration-150 active:scale-95"
          aria-label={auth.user?.avatarUrl
            ? m.onboarding_profile_photo_change()
            : m.onboarding_profile_photo_add()}
          onclick={() => (avatarModalOpen = true)}>
          <span class="block overflow-hidden rounded-full">
            <Avatar
              seed={auth.user?.username ?? ""}
              url={auth.user?.avatarUrl ?? null}
              size={layout.compact ? 112 : 168} />
          </span>
          <span
            class="bg-btn text-btn-fg border-bg absolute right-1 bottom-1 grid h-9 w-9 place-items-center rounded-full border-[3px]">
            <Icon name="camera" class="h-4 w-4" />
          </span>
        </button>
        <span class="text-accent text-sm font-semibold" aria-hidden="true">
          {auth.user?.avatarUrl
            ? m.onboarding_profile_photo_change()
            : m.onboarding_profile_photo_add()}
        </span>
      </div>
      <div class="max-w-md">
        <label class="mb-6 block">
          <span class="mb-1.5 block text-sm font-semibold">
            {m.common_display_name()}
          </span>
          <input
            type="text"
            name="displayName"
            class="input h-12 w-full text-base"
            autocomplete="nickname"
            minlength="1"
            maxlength={USER_LIMITS.displayName}
            bind:value={displayName}
            onblur={saveDisplayName} />
          {#if auth.user?.username}
            <span class="timecode text-dim mt-1.5 block text-xs">
              @{auth.user.username}
            </span>
          {/if}
        </label>
        {#if appConfig.socialEnabled && profileAccess}
          <p class="font-display mb-2.5 text-lg font-extrabold">
            {m.onboarding_profile_access_title()}
          </p>
          <SegmentedControl
            label={m.onboarding_profile_access_title()}
            options={ONBOARDING_ACCESS.map((a) => ({
              label: a.label,
              value: a.id,
            }))}
            value={profileAccess === ProfileAccess.GHOST ? "" : profileAccess}
            onChange={(v) => setAccess(v as ProfileAccess)} />
          <p class="text-dim mt-2 min-h-10 text-sm leading-snug">
            {ACCESS.find((a) => a.id === profileAccess)?.desc}
          </p>
        {/if}
      </div>
    </div>
  {:else if stepId === "settings"}
    {@render title(
      m.onboarding_settings_title(),
      m.onboarding_settings_intro(),
    )}
    <div class="md:grid md:max-w-4xl md:grid-cols-2 md:gap-x-12">
      <div>
        <section class="mb-6">
          <h3 class="font-display mb-0.5 text-lg font-extrabold">
            {m.common_theme()}
          </h3>
          <p class="text-dim mb-3 text-sm">
            {m.onboarding_settings_theme_desc()}
          </p>
          <div class="grid grid-cols-3 gap-2.5">
            {#each THEME_DEFINITIONS as theme (theme.mode)}
              <ThemePreview {theme} class="w-full" />
            {/each}
          </div>
        </section>
        <p class="text-dim mb-6 hidden text-sm md:block">
          {m.onboarding_settings_device({
            language: languageName(getLocale()),
            timezone: (auth.user?.timezone ?? "").replaceAll("_", " "),
          })}
        </p>
      </div>
      <div>
        {#if showServices && services.length > 0}
          <section class="mb-6">
            <h3 class="font-display mb-0.5 text-lg font-extrabold">
              {m.onboarding_settings_services_title()}
            </h3>
            <p class="text-dim mb-3 text-sm">
              {m.onboarding_settings_services_desc({
                region: formatRegion(catalogQuery.data?.region ?? "US"),
              })}
            </p>
            <div class="grid grid-cols-4 gap-2">
              {#each services as provider (provider.id)}
                {@const mine = myProviders.has(provider.id)}
                <button
                  type="button"
                  aria-pressed={mine}
                  class="relative grid justify-items-center gap-1.5 rounded-xl border-[1.5px] px-1 pt-2.5 pb-2 text-center text-[0.7rem] leading-tight font-semibold transition-colors duration-150 {mine
                    ? 'border-accent text-fg'
                    : 'border-border text-dim hover:text-fg'}"
                  onclick={() => toggleService(provider.id)}>
                  <span
                    class="bg-surface-2 block h-9 w-9 overflow-hidden rounded-[10px] transition-[filter,opacity] duration-200 {mine
                      ? ''
                      : 'opacity-60 grayscale'}">
                    {#if provider.logoUrl}
                      <img
                        src={provider.logoUrl}
                        alt=""
                        loading="lazy"
                        class="h-full w-full object-cover" />
                    {/if}
                  </span>
                  <span class="w-full truncate">{provider.name}</span>
                  {#if mine}
                    <span
                      class="bg-accent text-accent-fg absolute top-1 right-1 grid h-4 w-4 place-items-center rounded-full"
                      in:scale={{
                        start: 0.3,
                        duration: reduced ? 0 : 180,
                        easing: backOut,
                      }}>
                      <Icon name="check" class="h-2.5 w-2.5" />
                    </span>
                  {/if}
                </button>
              {/each}
            </div>
            {#if providerPicker.error}
              <p class="text-danger mt-2 text-sm">{providerPicker.error}</p>
            {/if}
          </section>
        {/if}
        <section class="mb-4">
          <h3 class="font-display mb-0.5 text-lg font-extrabold">
            {m.common_notifications()}
          </h3>
          <p class="text-dim mb-1 text-sm">
            {m.onboarding_settings_notify_desc()}
          </p>
          <div class="divide-border divide-y">
            <div
              class="flex min-h-16 items-center justify-between gap-4 py-2.5">
              <div>
                <p class="font-semibold">
                  {onPhone
                    ? m.onboarding_settings_push_label_phone()
                    : m.onboarding_settings_push_label_browser()}
                </p>
                <p class="text-dim text-sm leading-snug">{pushDescription}</p>
              </div>
              <Switch
                label={onPhone
                  ? m.onboarding_settings_push_label_phone()
                  : m.onboarding_settings_push_label_browser()}
                checked={pushOn}
                disabled={!pushSupported || pushMut.loading}
                onChange={togglePush} />
            </div>
            <div
              class="flex min-h-16 items-center justify-between gap-4 py-2.5">
              <div>
                <p class="font-semibold">
                  {m.onboarding_settings_email_label()}
                </p>
                <p class="text-dim text-sm leading-snug">
                  {m.onboarding_settings_email_desc()}
                </p>
              </div>
              <Switch
                label={m.onboarding_settings_email_label()}
                checked={(auth.user?.notifyEmail ?? DigestCadence.DISABLED) !==
                  DigestCadence.DISABLED}
                onChange={toggleEmailDigest} />
            </div>
            <div
              class="flex min-h-16 items-center justify-between gap-4 py-2.5">
              <div>
                <p class="font-semibold">{m.common_newsletter()}</p>
                <p class="text-dim text-sm leading-snug">
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
        </section>
        <p class="text-dim text-sm md:hidden">
          {m.onboarding_settings_device({
            language: languageName(getLocale()),
            timezone: (auth.user?.timezone ?? "").replaceAll("_", " "),
          })}
        </p>
      </div>
    </div>
  {:else}
    {@render title(m.onboarding_done_title(), m.onboarding_done_intro())}
    <div
      class="lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-14">
      <div
        class="bg-surface border-border relative mb-6 flex max-w-xl rounded-[18px] border shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)] md:rounded-[22px]"
        in:scale={{
          start: 0.9,
          duration: reduced ? 0 : 500,
          delay: reduced ? 0 : 120,
          easing: backOut,
        }}>
        <div class="min-w-0 flex-1 py-4.5 pr-4 pl-4.5 md:px-7 md:py-6.5">
          <p class="timecode text-xs">
            {m.onboarding_done_member_since({
              date: formatDate(auth.user?.createdAt ?? new Date()),
            })}
          </p>
          <p
            class="font-display mt-1.5 truncate text-[1.75rem] leading-none font-extrabold tracking-tight md:text-[2.75rem]">
            {auth.user?.displayName}
          </p>
          <p class="timecode mt-1 mb-3 text-xs md:mb-4">
            @{auth.user?.username}
          </p>
          <div class="mb-3 flex flex-wrap gap-1.5 md:mb-4 md:gap-2">
            {#each pickedDomains as { id } (id)}
              {@const accent = DOMAINS[id].accent}
              <span
                class="inline-flex h-6.5 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold md:h-7.5 md:text-sm"
                style:color={accent}
                style:background-color={`color-mix(in srgb, ${accent} 16%, transparent)`}>
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  style:background-color={accent}></span>
                {DOMAINS[id].label}
              </span>
            {/each}
          </div>
          <ul class="text-dim flex flex-col gap-1 text-[0.8rem] md:text-sm">
            {#each facts as fact (fact)}
              <li class="flex items-center gap-2">
                <Icon name="check" class="text-accent h-3.5 w-3.5 shrink-0" />
                {fact}
              </li>
            {/each}
          </ul>
        </div>
        <div
          class="border-border relative flex w-20 shrink-0 flex-col items-center justify-center border-l-2 border-dashed md:w-28"
          aria-hidden="true">
          <span
            class="bg-bg border-border absolute -top-2.75 -left-2.75 h-5 w-5 rounded-full border"
          ></span>
          <span
            class="bg-bg border-border absolute -bottom-2.75 -left-2.75 h-5 w-5 rounded-full border"
          ></span>
          <span
            class="timecode text-accent border-accent -rotate-14 rounded-md border-2 px-1 py-1.5 text-center text-[0.65rem] leading-tight font-bold md:text-xs"
            in:scale={{
              start: 1.8,
              duration: reduced ? 0 : 350,
              delay: reduced ? 0 : 650,
              easing: backOut,
            }}>
            {m.common_welcome()}
          </span>
        </div>
      </div>
      {#if firstSteps.length > 0}
        <section>
          <h3 class="font-display mb-0.5 text-lg font-extrabold">
            {m.onboarding_done_first_steps_title()}
          </h3>
          <p class="text-dim mb-2 text-sm">
            {m.onboarding_done_first_steps_desc({
              achievement: m.gamification_premiere_seance_name(),
            })}
          </p>
          <ul class="divide-border divide-y">
            {#each firstSteps as step (step.key)}
              <li class="flex min-h-13 items-center gap-3">
                {#if step.state === "done"}
                  <span
                    class="bg-accent text-accent-fg grid h-5 w-5 place-items-center rounded-full">
                    <Icon name="check" class="h-3 w-3" />
                  </span>
                {:else}
                  <span
                    class="border-dim h-5 w-5 rounded-full border-[1.5px] border-dashed"
                  ></span>
                {/if}
                <span class="font-semibold">{stepLabel(step.key)}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
  {/if}
</Wizard>

{#snippet posterWall(cls: string)}
  <div class="absolute -top-8 -left-10 grid -rotate-8 {cls}">
    {#each wall as tile, i (i)}
      <span
        class="block w-16 overflow-hidden rounded-md lg:w-26 {i % 2
          ? 'mt-8 lg:mt-14'
          : ''}"
        style:background={tile.bg ?? undefined}>
        {#if tile.src}
          <img
            src={tile.src}
            alt=""
            class="h-full w-full object-cover"
            loading="lazy" />
        {/if}
      </span>
    {/each}
  </div>
  <div
    class="from-bg pointer-events-none absolute inset-0 bg-linear-to-t to-transparent to-70% lg:bg-linear-to-r lg:to-35%">
  </div>
{/snippet}

{#if avatarModalOpen && auth.user}
  <EditAvatarModal
    seed={auth.user.username}
    avatarUrl={auth.user.avatarUrl}
    onSaved={(url) => {
      if (auth.user) auth.user.avatarUrl = url;
    }}
    onclose={() => (avatarModalOpen = false)} />
{/if}
