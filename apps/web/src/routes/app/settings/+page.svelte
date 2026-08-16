<script lang="ts">
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
    { id: "securite", label: m.settings_section_security() },
    { id: "contenu", label: m.settings_section_content() },
    {
      id: "confidentialite",
      label: m.settings_section_privacy(),
      social: true,
    },
    { id: "domaines", label: m.settings_section_domains() },
    { id: "communications", label: m.settings_section_communications() },
    { id: "apparence", label: m.settings_section_appearance() },
    { id: "import", label: m.settings_section_import() },
    { id: "export", label: m.settings_section_export() },
    {
      id: "aide",
      label: m.settings_section_help(),
      newBadgeKey: "help-feedback",
    },
    {
      id: "soutien",
      label: m.settings_section_support(),
      newBadgeKey: "support",
    },
    { id: "sources-donnees", label: m.settings_section_datasources() },
    { id: "danger", label: m.settings_section_danger_zone() },
  ];
  const visibleSections = $derived(
    SECTIONS.filter((s) => !s.social || appConfig.socialEnabled),
  );

  let containerEl = $state<HTMLElement | null>(null);
  let activeId = $state(SECTIONS[0].id);

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
  <PageHeader icon="gear" title={m.settings_title()} class="mb-6" />

  {#if auth.user}
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

      <div bind:this={containerEl} class="min-w-0">
        <div id="securite" data-section-id="securite">
          <SecuritySection />
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
