<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { ApiError, completeOnboarding, updateMe } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { IMPORTS_DEFINITION } from "$lib/constants/import-sources";
  import { toggleDomainSelection } from "$lib/domains";
  import { m } from "$lib/paraglide/messages.js";
  import { setLocale } from "$lib/paraglide/runtime.js";
  import { disablePush, enablePush, isPushSupported } from "$lib/push";
  import { theme } from "$lib/theme.svelte";
  import type { ImportSourceDescriptor } from "$lib/types/import-descriptor";
  import { Domain } from "@loomkeep/shared";
  import Icon from "../Icon.svelte";
  import Switch from "../Switch.svelte";
  import Wizard from "../Wizard.svelte";

  const PICKABLE_DOMAINS = [
    Domain.MEDIA,
    Domain.GAMES,
    Domain.BOOKS,
    Domain.MUSIC,
  ];

  const STEPS = [
    { id: "welcome", label: m.onboarding_step_welcome() },
    { id: "domains", label: m.onboarding_step_domains() },
    { id: "settings", label: m.onboarding_step_settings() },
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

  async function toggleDomain(id: Domain) {
    if (!auth.user) return;
    const next = toggleDomainSelection(auth.user.enabledDomains, id);
    if (next === auth.user.enabledDomains) return;
    await updateMe({ enabledDomains: next }).catch(() => undefined);
  }

  async function saveLocale(next: "fr" | "en") {
    if (auth.user?.locale === next) return;
    await updateMe({ locale: next });
    setLocale(next);
  }

  const THEME_PREVIEWS = [
    {
      mode: "dark" as const,
      label: m.onboarding_settings_theme_dark(),
      bg: "#0c0d10",
      surface: "#15171c",
      line: "#2a2e38",
      accent: "#f5b841",
    },
    {
      mode: "light" as const,
      label: m.onboarding_settings_theme_light(),
      bg: "#edece8",
      surface: "#fbfaf7",
      line: "#dad8d0",
      accent: "#a56a15",
    },
  ];

  let notifyError = $state("");
  let pushBusy = $state(false);
  const pushSupported = isPushSupported();

  async function toggleNotify(key: "notifyEmail" | "notifyNewsletter") {
    if (!auth.user) return;
    notifyError = "";
    try {
      await updateMe({ [key]: !auth.user[key] });
    } catch (err) {
      notifyError =
        err instanceof ApiError ? err.message : m.common_save_error_fallback();
    }
  }

  async function togglePush() {
    if (!auth.user || pushBusy) return;
    notifyError = "";
    pushBusy = true;
    try {
      if (auth.user.notifyPush) {
        await disablePush();
        await updateMe({ notifyPush: false });
      } else {
        const ok = await enablePush();
        if (!ok) {
          notifyError = m.onboarding_settings_push_error();
          return;
        }
        await updateMe({ notifyPush: true });
      }
    } catch (err) {
      notifyError =
        err instanceof ApiError ? err.message : m.common_save_error_fallback();
    } finally {
      pushBusy = false;
    }
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
      {m.onboarding_settings_title()}
    </h2>
    <p class="text-dim mb-4 text-sm">{m.onboarding_settings_intro()}</p>

    <div class="mb-5">
      <p class="mb-2 text-sm font-semibold">{m.onboarding_settings_theme()}</p>
      <div class="flex gap-2">
        {#each THEME_PREVIEWS as t (t.mode)}
          {@const active = theme.mode === t.mode}
          <button
            type="button"
            class="w-28 rounded-lg border p-2 text-center transition-colors {active
              ? 'border-accent'
              : 'border-border'}"
            onclick={() => theme.mode !== t.mode && theme.toggle()}>
            <div class="mb-2 overflow-hidden rounded" style="background:{t.bg}">
              <div
                class="flex h-3 items-center gap-1 px-1.5"
                style="background:{t.surface}">
                <span class="h-1 w-1 rounded-full" style="background:{t.accent}"
                ></span>
                <span class="h-0.5 w-3 rounded-full" style="background:{t.line}"
                ></span>
              </div>
              <div class="flex flex-col gap-1 p-1.5">
                <span
                  class="h-0.5 rounded-full"
                  style="width:55%;background:{t.line}"></span>
                <span
                  class="h-0.5 rounded-full"
                  style="width:35%;background:{t.accent}"></span>
              </div>
            </div>
            <span
              class="text-xs font-semibold {active
                ? 'text-accent'
                : 'text-dim'}">
              {t.label}
            </span>
          </button>
        {/each}
      </div>
    </div>

    <div class="mb-5">
      <p class="mb-2 text-sm font-semibold">{m.settings_language_label()}</p>
      <div class="flex gap-2">
        <button
          type="button"
          class="chip"
          class:chip-on={(auth.user?.locale ?? "fr") === "fr"}
          onclick={() => saveLocale("fr")}>
          {m.settings_language_fr()}
        </button>
        <button
          type="button"
          class="chip"
          class:chip-on={auth.user?.locale === "en"}
          onclick={() => saveLocale("en")}>
          {m.settings_language_en()}
        </button>
      </div>
    </div>

    <div class="divide-border divide-y">
      <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
        <div>
          <p class="text-sm font-semibold">
            {m.onboarding_settings_push_label()}
          </p>
          <p class="text-dim text-xs">
            {#if !pushSupported}
              {m.onboarding_settings_push_unsupported()}
            {:else if isIphone}
              {m.onboarding_settings_push_desc_iphone()}
            {:else}
              {m.onboarding_settings_push_desc()}
            {/if}
          </p>
        </div>
        <Switch
          label={m.onboarding_settings_push_label()}
          checked={auth.user?.notifyPush ?? false}
          disabled={!pushSupported || pushBusy}
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
          checked={auth.user?.notifyEmail ?? false}
          onChange={() => toggleNotify("notifyEmail")} />
      </div>
      <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
        <div>
          <p class="text-sm font-semibold">
            {m.onboarding_settings_newsletter_label()}
          </p>
          <p class="text-dim text-xs">
            {m.onboarding_settings_newsletter_desc()}
          </p>
        </div>
        <Switch
          label={m.onboarding_settings_newsletter_label()}
          checked={auth.user?.notifyNewsletter ?? false}
          onChange={() => toggleNotify("notifyNewsletter")} />
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
