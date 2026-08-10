<script lang="ts">
  import { ApiError, getAdminNewsletterSends } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import type { NewsletterSendDto } from "@loomkeep/shared";

  let sends = $state<NewsletterSendDto[] | null>(null);
  let loading = $state(true);
  let loadError = $state("");

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  async function load() {
    loading = true;
    loadError = "";
    try {
      sends = await getAdminNewsletterSends();
    } catch (err) {
      loadError =
        err instanceof ApiError ? err.message : "Historique indisponible";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });
</script>

<div class="mx-auto max-w-2xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="sparkles"
    title="Newsletter"
    subtitle="Envoyée automatiquement à chaque publication d'une note de version sur Quackback — rien à faire ici, cette page n'est qu'un historique." />

  <section class="card p-5 md:p-6">
    <h2 class="font-display mb-3 text-lg font-bold">Envois</h2>

    {#if loadError}
      <Banner variant="error">{loadError}</Banner>
    {:else if loading}
      <div class="space-y-2">
        {#each { length: 3 } as _, i (i)}
          <div class="skeleton h-14 rounded-lg"></div>
        {/each}
      </div>
    {:else if sends && sends.length > 0}
      <ul
        class="border-border divide-border divide-y overflow-hidden rounded-lg border">
        {#each sends as send (send.id)}
          <li class="flex items-center gap-3 px-3 py-2.5">
            <div class="min-w-0 flex-1">
              <p class="text-fg truncate text-sm font-semibold">
                {send.title}
              </p>
              <p class="timecode text-xs">
                {dateFmt.format(new Date(send.sentAt))} · {send.recipientCount}
                destinataire{send.recipientCount > 1 ? "s" : ""}
              </p>
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-dim py-6 text-center text-sm">
        Aucun envoi pour l'instant.
      </p>
    {/if}
  </section>
</div>
