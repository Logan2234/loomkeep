<script lang="ts">
  import {
    API_URL,
    ApiError,
    getCalendarToken,
    regenerateCalendarToken,
  } from "$lib/api/client";
  import { m } from "$lib/paraglide/messages";
  import { toast } from "$lib/toast.svelte";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";

  let { onclose }: { onclose: () => void } = $props();

  let token = $state<string | null>(null);
  let loading = $state(true);
  let busy = $state(false);
  let error = $state("");
  let confirmingRegenerate = $state(false);
  let copied = $state(false);

  $effect(() => {
    getCalendarToken()
      .then((result) => (token = result.token))
      .catch((err) => {
        error =
          err instanceof ApiError
            ? err.message
            : "Impossible de générer le lien.";
      })
      .finally(() => (loading = false));
  });

  function calendarUrl(t: string): string {
    return `${API_URL}/library/calendar.ics?token=${t}`;
  }

  async function copyLink() {
    if (!token) return;
    await navigator.clipboard.writeText(calendarUrl(token));
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  async function regenerate() {
    busy = true;
    error = "";
    try {
      const result = await regenerateCalendarToken();
      token = result.token;
      confirmingRegenerate = false;
      await navigator.clipboard.writeText(calendarUrl(result.token));
      toast.success("Nouveau lien copié — l'ancien ne fonctionne plus.");
    } catch (err) {
      error =
        err instanceof ApiError
          ? err.message
          : "Impossible de régénérer le lien.";
    } finally {
      busy = false;
    }
  }
</script>

<Modal title="Ajouter à mon agenda" {onclose}>
  {#if loading}
    <p class="text-dim text-sm">Génération du lien…</p>
  {:else if error && !token}
    <p class="text-danger text-sm">{error}</p>
  {:else if confirmingRegenerate}
    <p class="text-dim text-sm">
      L'ancien lien cessera de fonctionner — tu devras t'abonner à nouveau
      depuis tes autres agendas. Continuer ?
    </p>
    {#if error}
      <p class="text-danger mt-2 text-sm">{error}</p>
    {/if}
    <div class="mt-5 flex justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        disabled={busy}
        onclick={() => (confirmingRegenerate = false)}>
        {m.common_cancel()}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        disabled={busy}
        onclick={regenerate}>
        {busy ? "Régénération…" : "Régénérer"}
      </button>
    </div>
  {:else}
    <p class="text-dim text-sm">
      Ce lien te permet de t'abonner au calendrier des prochains épisodes de ce
      que tu suis depuis Google Calendar, Apple Calendar ou toute application
      compatible — les nouvelles dates apparaissent automatiquement, sans rien
      réimporter.
    </p>
    <p class="text-dim mt-2 text-sm">
      Le lien est personnel : ne le partage pas.
    </p>
    <div class="mt-5 flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        onclick={() => (confirmingRegenerate = true)}>
        Régénérer le lien
      </button>
      <button class="btn btn-primary" onclick={copyLink}>
        <Icon name={copied ? "check" : "link"} class="h-4 w-4" />
        {copied ? "Lien copié" : "Copier le lien"}
      </button>
    </div>
  {/if}
</Modal>
