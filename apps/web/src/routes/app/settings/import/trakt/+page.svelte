<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import SegmentedStatusControl from "$lib/components/SegmentedStatusControl.svelte";
  import { m } from "$lib/paraglide/messages.js";

  // Two ways to bring in a Trakt account: the live API (works today, needs a
  // public profile) or Trakt's own "Settings > Data > Export" archive (not
  // wired up yet — its exact JSON shape isn't confirmed, see the placeholder
  // below). Kept local to this page rather than generalizing ImportWizard's
  // single-input-type descriptor for a method that doesn't work yet.
  type Method = "public" | "file";
  let method = $state<Method>("public");
</script>

{#snippet methodToggle()}
  <SegmentedStatusControl
    statuses={["public", "file"] as Method[]}
    current={method}
    disabled={false}
    meta={{
      public: { label: "Pseudo public" },
      file: { label: "Fichier d'export" },
    }}
    desc={{
      public: "Importer via l'API Trakt (profil public)",
      file: "Importer depuis l'archive téléchargée sur trakt.tv",
    }}
    activeClass={{ public: "bg-accent text-bg", file: "bg-accent text-bg" }}
    onSelect={(next) => (method = next)} />
{/snippet}

{#if method === "public"}
  <ImportWizard source="trakt">
    {#snippet intro()}
      <div class="mb-4">{@render methodToggle()}</div>
      Indique ton pseudo Trakt. On récupère ton historique (séries et films vus, épisode
      par épisode) et ta watchlist directement depuis Trakt — rien à exporter. Ton
      profil doit être
      <strong class="text-fg">public</strong> le temps de l'import (<a
        href="https://trakt.tv/settings/privacy"
        target="_blank"
        rel="noopener noreferrer"
        class="link-accent">réglages de confidentialité ↗</a
      >).
    {/snippet}
  </ImportWizard>
{:else}
  <div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
    <div class="mb-6 flex items-center gap-3">
      <a
        href="/app/settings/import"
        class="text-dim hover:text-fg"
        aria-label={m.common_back()}>
        <Icon name="chevron-left" class="h-5 w-5" />
      </a>
      <h1
        class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        Import Trakt
      </h1>
    </div>

    <div class="mb-6">{@render methodToggle()}</div>

    <div
      class="border-border text-dim flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center">
      <Icon name="archive" class="text-dim h-6 w-6" />
      <p class="text-fg font-semibold">Bientôt disponible</p>
      <p class="max-w-sm text-sm">
        On pourra bientôt importer directement l'archive téléchargée depuis
        <span class="text-fg">trakt.tv → Réglages → Data → Export</span>, sans
        que ton profil ait besoin d'être public.
      </p>
    </div>
  </div>
{/if}
