<script lang="ts">
  import { page } from "$app/state";
  import { auth } from "$lib/auth.svelte";
  import LegalLinks from "$lib/components/LegalLinks.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
  import AppearanceSection from "./components/AppearanceSection.svelte";
  import CommunicationsSection from "./components/CommunicationsSection.svelte";
  import DangerZoneSection from "./components/DangerZoneSection.svelte";
  import DataSourcesSection from "./components/DataSourcesSection.svelte";
  import DomainsSection from "./components/DomainsSection.svelte";
  import ExportSection from "./components/ExportSection.svelte";
  import HelpFeedbackSection from "./components/HelpFeedbackSection.svelte";
  import ImportSection from "./components/ImportSection.svelte";
  import MfaSection from "./components/MfaSection.svelte";
  import PrivacySection from "./components/PrivacySection.svelte";
  import ProfileSection from "./components/ProfileSection.svelte";
  import SecuritySection from "./components/SecuritySection.svelte";
  import SupportSection from "./components/SupportSection.svelte";

  // Section table of contents (desktop only) — id must match the wrapper
  // below each section component. `social` entries hide when the flag is off.
  const SECTIONS: {
    id: string;
    label: string;
    social?: boolean;
    newBadgeKey?: Parameters<typeof isFeatureNew>[0];
  }[] = [
    { id: "securite", label: m.common_security() },
    {
      id: "mfa",
      label: m.settings_section_mfa(),
      newBadgeKey: "mfa",
    },
    { id: "contenu", label: m.settings_section_content() },
    {
      id: "confidentialite",
      label: m.common_privacy(),
      social: true,
    },
    { id: "domaines", label: m.common_domains() },
    { id: "communications", label: m.settings_section_communications() },
    {
      id: "apparence",
      label: m.settings_appearance_title(),
      newBadgeKey: "nav-styles",
    },
    { id: "import", label: m.common_import() },
    { id: "export", label: m.common_export() },
    { id: "aide", label: `${m.common_help()} & ${m.common_feedback()}` },
    { id: "soutien", label: m.settings_section_support() },
    { id: "sources-donnees", label: m.settings_datasources_title() },
    { id: "danger", label: m.settings_danger_zone_title() },
  ];
  const visibleSections = $derived(
    SECTIONS.filter((s) => !s.social || appConfig.socialEnabled),
  );

  let containerEl = $state<HTMLElement | null>(null);
  let activeId = $state(SECTIONS[0].id);
  let compactTocEl = $state<HTMLElement | null>(null);

  // Deep links like /app/settings#aide (the home page's "Aide & Feedback"
  // shortcut) can't rely on the browser resolving the fragment: these routes
  // are SPA-rendered, so #aide doesn't exist in the DOM yet when the
  // navigation lands. Resolve it once the sections are mounted.
  $effect(() => {
    const id = page.url.hash.slice(1);
    if (!id || !containerEl) return;
    if (!SECTIONS.some((s) => s.id === id)) return;
    requestAnimationFrame(() => scrollToSection(id));
  });

  // The compact TOC is a horizontal scroller, so the active chip has to be
  // brought into view as the scroll-spy advances or the bar stops telling
  // you where you are.
  $effect(() => {
    const chip = compactTocEl?.querySelector<HTMLElement>(
      `[data-toc-id="${activeId}"]`,
    );
    chip?.scrollIntoView({ block: "nearest", inline: "center" });
  });

  function scrollToSection(id: string) {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Scroll-spy: whichever section wrapper crosses the upper band of the
  // viewport becomes active in the TOC.
  $effect(() => {
    const container = containerEl;
    if (!container) return;
    const targets = Array.from(
      container.querySelectorAll<HTMLElement>("[data-section-id]"),
    );
    if (targets.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            activeId = e.target.getAttribute("data-section-id") ?? activeId;
          }
        }
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    for (const t of targets) io.observe(t);

    // The IO band never reaches the last section once the page bottom is
    // scrolled into view (nothing left below it to cross the "-70%" line) —
    // force the last section active once we're at the very bottom.
    function onScroll() {
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (atBottom) {
        const last = targets[targets.length - 1];
        activeId = last?.getAttribute("data-section-id") ?? activeId;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  });
</script>

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10 lg:max-w-5xl">
  <PageHeader
    icon="gear"
    back="/app/profile"
    title={m.common_settings()}
    class="mb-6" />

  {#if auth.user}
    <!-- Under lg the sidebar TOC is hidden, which left a 5000px+ page with no
         way to jump: same sections as a sticky scroller instead. -->
    <nav
      bind:this={compactTocEl}
      aria-label={m.common_settings()}
      class="bg-bg/95 border-border no-scrollbar sticky top-0 z-20 -mx-5 mb-4 flex snap-x gap-2 overflow-x-auto border-b px-5 py-2.5 backdrop-blur md:-mx-8 md:px-8 lg:hidden">
      {#each visibleSections as s (s.id)}
        <button
          type="button"
          data-toc-id={s.id}
          onclick={() => scrollToSection(s.id)}
          aria-current={activeId === s.id ? "true" : undefined}
          class="chip shrink-0 snap-center text-[0.7rem] whitespace-nowrap {activeId ===
          s.id
            ? 'chip-on'
            : ''}">
          {s.label}
          {#if s.newBadgeKey && isFeatureNew(s.newBadgeKey)}
            <span
              class="bg-accent ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
              aria-hidden="true"></span>
          {/if}
        </button>
      {/each}
    </nav>

    <div class="mb-6 lg:grid lg:grid-cols-[180px_1fr] lg:gap-10">
      <nav class="hidden lg:sticky lg:top-8 lg:block lg:h-fit">
        <ul class="border-border space-y-1 border-l">
          {#each visibleSections as s (s.id)}
            <li>
              <a
                href={`#${s.id}`}
                onclick={(e) => {
                  e.preventDefault();
                  scrollToSection(s.id);
                }}
                class="-ml-px block border-l-2 py-1.5 pl-3 text-xs font-bold tracking-widest uppercase transition-colors {activeId ===
                s.id
                  ? 'border-accent text-fg'
                  : 'text-dim hover:text-fg border-transparent'}">
                {s.label}
                {#if s.newBadgeKey && isFeatureNew(s.newBadgeKey)}
                  <span
                    class="bg-accent ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                    aria-hidden="true"></span>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </nav>

      <!-- scroll-mt clears the compact TOC bar, which is sticky over the
           top of whichever section it jumps to. -->
      <div
        bind:this={containerEl}
        class="min-w-0 [&>[data-section-id]]:scroll-mt-16 lg:[&>[data-section-id]]:scroll-mt-0">
        <div id="securite" data-section-id="securite">
          <SecuritySection />
        </div>
        <div id="mfa" data-section-id="mfa">
          <MfaSection />
        </div>
        <div id="contenu" data-section-id="contenu">
          <ProfileSection />
        </div>
        <div id="confidentialite" data-section-id="confidentialite">
          <PrivacySection />
        </div>
        <div id="domaines" data-section-id="domaines">
          <DomainsSection />
        </div>
        <div id="communications" data-section-id="communications">
          <CommunicationsSection />
        </div>
        <div id="apparence" data-section-id="apparence">
          <AppearanceSection />
        </div>
        <div id="import" data-section-id="import">
          <ImportSection />
        </div>
        <div id="export" data-section-id="export">
          <ExportSection />
        </div>
        <div id="aide" data-section-id="aide">
          <HelpFeedbackSection />
        </div>
        <div id="soutien" data-section-id="soutien">
          <SupportSection />
        </div>
        <div id="sources-donnees" data-section-id="sources-donnees">
          <DataSourcesSection />
        </div>
        <div id="danger" data-section-id="danger">
          <DangerZoneSection />
        </div>
      </div>
    </div>
  {/if}

  <LegalLinks />
</div>
