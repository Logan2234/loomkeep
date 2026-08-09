<script lang="ts">
  import {
    ApiError,
    createAdminChangelogEntry,
    deleteAdminChangelogEntry,
    getAdminChangelog,
    getAdminVersion,
    sendAdminChangelogNewsletter,
    updateAdminChangelogEntry,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { toast } from "$lib/toast.svelte";
  import type { ChangelogEntryDto } from "@loomkeep/shared";

  let entries = $state<ChangelogEntryDto[] | null>(null);
  let loading = $state(true);
  let loadError = $state("");

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  async function load() {
    loading = true;
    loadError = "";
    try {
      entries = await getAdminChangelog();
    } catch (err) {
      loadError =
        err instanceof ApiError ? err.message : "Changelog indisponible";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  // ---------------------------------------------------------------- Form --

  let editingId = $state<string | null>(null);
  let version = $state("");
  let title = $state("");
  let highlights = $state<string[]>([""]);
  let formError = $state("");
  let saving = $state(false);

  // Prefill the version field with the running app's version — a brand-new
  // entry is almost always for the release just shipped, but stays editable
  // (backfilling an older entry, correcting a typo).
  $effect(() => {
    if (editingId) return;
    getAdminVersion()
      .then((v) => (version = v.version))
      .catch(() => {});
  });

  function resetForm() {
    editingId = null;
    version = "";
    title = "";
    highlights = [""];
    formError = "";
  }

  function editEntry(entry: ChangelogEntryDto) {
    editingId = entry.id;
    version = entry.version;
    title = entry.title;
    highlights = [...entry.highlights];
    formError = "";
  }

  function addHighlight() {
    highlights = [...highlights, ""];
  }

  function removeHighlight(index: number) {
    if (highlights.length <= 1) return;
    highlights = highlights.filter((_, i) => i !== index);
  }

  async function submit() {
    const cleanHighlights = highlights.map((h) => h.trim()).filter(Boolean);
    if (!version.trim() || !title.trim() || cleanHighlights.length === 0) {
      formError = "Version, titre et au moins une nouveauté sont requis.";
      return;
    }

    saving = true;
    formError = "";
    try {
      const body = {
        version: version.trim(),
        title: title.trim(),
        highlights: cleanHighlights,
      };
      if (editingId) {
        await updateAdminChangelogEntry(editingId, body);
        toast.success("Entrée mise à jour.");
      } else {
        await createAdminChangelogEntry(body);
        toast.success("Entrée créée.");
      }
      resetForm();
      await load();
    } catch (err) {
      formError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    } finally {
      saving = false;
    }
  }

  // -------------------------------------------------------------- Delete --

  let pendingDelete = $state<ChangelogEntryDto | null>(null);
  let deleting = $state(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    deleting = true;
    try {
      await deleteAdminChangelogEntry(pendingDelete.id);
      if (editingId === pendingDelete.id) resetForm();
      pendingDelete = null;
      toast.success("Entrée supprimée.");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Suppression impossible",
      );
    } finally {
      deleting = false;
    }
  }

  // ---------------------------------------------------------------- Send --

  let pendingSend = $state<ChangelogEntryDto | null>(null);
  let sending = $state(false);

  async function confirmSend() {
    if (!pendingSend) return;
    sending = true;
    try {
      const res = await sendAdminChangelogNewsletter(pendingSend.id);
      pendingSend = null;
      toast.success(
        res.recipientCount > 0
          ? `Newsletter envoyée à ${res.recipientCount} compte${res.recipientCount > 1 ? "s" : ""}.`
          : "Aucun compte abonné à la newsletter — rien n'a été envoyé.",
      );
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Échec de l'envoi");
    } finally {
      sending = false;
    }
  }
</script>

<div class="mx-auto max-w-2xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="sparkles"
    title="Changelog"
    subtitle="Notes de version publiques (/changelog) et envoi de la newsletter aux comptes abonnés." />

  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-3 text-lg font-bold">
      {editingId ? "Modifier l'entrée" : "Nouvelle entrée"}
    </h2>

    <div class="grid gap-3 sm:grid-cols-[140px_1fr]">
      <div>
        <label
          for="cl-version"
          class="text-dim mb-1 block text-xs font-semibold">
          Version
        </label>
        <input
          id="cl-version"
          type="text"
          bind:value={version}
          placeholder="1.2.0"
          class="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm" />
      </div>
      <div>
        <label for="cl-title" class="text-dim mb-1 block text-xs font-semibold">
          Titre
        </label>
        <input
          id="cl-title"
          type="text"
          bind:value={title}
          placeholder="Photos de profil & partage"
          class="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm" />
      </div>
    </div>

    <div class="mt-3">
      <span class="text-dim mb-1 block text-xs font-semibold">Nouveautés</span>
      <div class="space-y-2">
        {#each highlights as _, i (i)}
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={highlights[i]}
              placeholder="Une nouveauté par ligne"
              class="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm" />
            {#if highlights.length > 1}
              <button
                type="button"
                aria-label="Retirer cette nouveauté"
                onclick={() => removeHighlight(i)}
                class="text-dim hover:bg-danger/10 hover:text-danger shrink-0 rounded-lg p-2 transition-colors">
                <Icon name="x" class="h-4 w-4" />
              </button>
            {/if}
          </div>
        {/each}
      </div>
      <button
        type="button"
        onclick={addHighlight}
        class="text-accent mt-2 text-xs font-semibold hover:underline">
        + Ajouter une nouveauté
      </button>
    </div>

    {#if formError}
      <Banner variant="error" class="mt-3">{formError}</Banner>
    {/if}

    <div class="mt-4 flex gap-2">
      {#if editingId}
        <button type="button" class="btn btn-ghost" onclick={resetForm}>
          Annuler
        </button>
      {/if}
      <button
        type="button"
        class="btn btn-primary"
        disabled={saving}
        onclick={submit}>
        {saving
          ? "Enregistrement…"
          : editingId
            ? "Enregistrer"
            : "Créer l'entrée"}
      </button>
    </div>
  </section>

  <section class="card p-5 md:p-6">
    <h2 class="font-display mb-3 text-lg font-bold">Entrées publiées</h2>

    {#if loadError}
      <Banner variant="error">{loadError}</Banner>
    {:else if loading}
      <div class="space-y-2">
        {#each { length: 3 } as _, i (i)}
          <div class="skeleton h-14 rounded-lg"></div>
        {/each}
      </div>
    {:else if entries && entries.length > 0}
      <ul
        class="border-border divide-border divide-y overflow-hidden rounded-lg border">
        {#each entries as entry (entry.id)}
          <li class="flex items-center gap-3 px-3 py-2.5">
            <span
              class="bg-accent/15 text-accent shrink-0 rounded-md px-2 py-1 font-mono text-xs font-bold tabular-nums">
              v{entry.version}
            </span>
            <a
              href="/changelog#v{entry.version}"
              target="_blank"
              rel="noopener"
              class="min-w-0 flex-1 hover:opacity-80">
              <p class="text-fg truncate text-sm font-semibold">
                {entry.title}
              </p>
              <p class="timecode text-xs">
                {dateFmt.format(new Date(entry.publishedAt))}
                {#if entry.emailSentAt}
                  · mail envoyé le {dateFmt.format(new Date(entry.emailSentAt))}
                {/if}
              </p>
            </a>
            <button
              type="button"
              onclick={() => (pendingSend = entry)}
              class="chip shrink-0 text-xs">
              {entry.emailSentAt ? "Renvoyer" : "Envoyer"}
            </button>
            <button
              type="button"
              aria-label="Modifier cette entrée"
              onclick={() => editEntry(entry)}
              class="text-dim hover:bg-surface-2 hover:text-fg shrink-0 rounded-lg p-1.5 transition-colors">
              <Icon name="edit" class="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Supprimer cette entrée"
              onclick={() => (pendingDelete = entry)}
              class="text-dim hover:bg-danger/10 hover:text-danger shrink-0 rounded-lg p-1.5 transition-colors">
              <Icon name="trash" class="h-4 w-4" />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-dim py-6 text-center text-sm">
        Aucune entrée pour l'instant.
      </p>
    {/if}
  </section>
</div>

{#if pendingSend}
  <ConfirmationModal
    title={pendingSend.emailSentAt
      ? "Renvoyer la newsletter ?"
      : "Envoyer la newsletter ?"}
    message={`« ${pendingSend.title} » (v${pendingSend.version}) sera envoyée par email à tous les comptes abonnés à la newsletter.${pendingSend.emailSentAt ? " Elle a déjà été envoyée une fois." : ""}`}
    confirmLabel={pendingSend.emailSentAt ? "Renvoyer" : "Envoyer"}
    busy={sending}
    onConfirm={confirmSend}
    onCancel={() => (pendingSend = null)} />
{/if}

{#if pendingDelete}
  <ConfirmationModal
    title="Supprimer cette entrée ?"
    message={`« ${pendingDelete.title} » (v${pendingDelete.version}) sera définitivement supprimée. La page /changelog et l'email déjà envoyé (si applicable) n'en gardent aucune trace.`}
    confirmLabel="Supprimer"
    danger
    busy={deleting}
    onConfirm={confirmDelete}
    onCancel={() => (pendingDelete = null)} />
{/if}
