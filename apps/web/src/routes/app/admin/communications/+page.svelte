<script lang="ts">
  // Merges the former /admin/emails and /admin/push pages: same admin gesture
  // on two channels (preview/test-send a template vs. test/broadcast a push),
  // now two tabs of one page instead of two nav entries.
  import { page } from "$app/state";
  import {
    getAdminEmailPreview,
    getAdminEmailTemplates,
    getAdminPushDevices,
    getAdminPushSummary,
    getAdminUserOptions,
    sendAdminBroadcastPush,
    sendAdminTestEmail,
    sendAdminTestPush,
    ApiError,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import KpiStrip from "$lib/components/stats/KpiStrip.svelte";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import SectionLabel from "$lib/components/stats/SectionLabel.svelte";
  import { toast } from "$lib/toast.svelte";
  import type {
    AdminPushBroadcastResponseDto,
    AdminPushDeviceDto,
    AdminPushSendResponseDto,
    AdminPushSummaryDto,
    AdminUserOptionDto,
    MailTemplateInfoDto,
  } from "@loomkeep/shared";

  type Tab = "email" | "push";
  let tab = $state<Tab>(
    page.url.searchParams.get("tab") === "push" ? "push" : "email",
  );

  // ---------------------------------------------------------------- Email --

  let templates = $state<MailTemplateInfoDto[] | null>(null);
  let smtpConfigured = $state(false);
  let emailLoading = $state(true);
  let emailLoadError = $state<string | null>(null);

  let selectedKey = $state<string | null>(null);
  const selectedTemplate = $derived(
    templates?.find((t) => t.key === selectedKey) ?? null,
  );

  /** Editable sample-data values for the selected template, keyed by field key. */
  let fieldValues = $state<Record<string, string>>({});

  let previewSubject = $state<string | null>(null);
  let previewHtml = $state<string | null>(null);
  let previewText = $state<string | null>(null);
  let previewLoading = $state(false);
  let previewTab = $state<"html" | "text">("html");

  let copied = $state(false);
  let previewDebounce: ReturnType<typeof setTimeout> | undefined;

  let testTo = $state("");
  let sendingEmail = $state(false);
  let sendResult = $state<{ ok: boolean; message: string } | null>(null);

  async function loadEmails() {
    emailLoading = true;
    emailLoadError = null;
    try {
      const res = await getAdminEmailTemplates();
      templates = res.templates;
      smtpConfigured = res.smtpConfigured;
      if (templates.length > 0) selectTemplate(templates[0].key);
    } catch (err) {
      emailLoadError =
        err instanceof ApiError ? err.message : "Gabarits indisponibles";
    } finally {
      emailLoading = false;
    }
  }

  function selectTemplate(key: string) {
    selectedKey = key;
    sendResult = null;
    const template = templates?.find((t) => t.key === key);
    fieldValues = Object.fromEntries(
      (template?.fields ?? []).map((f) => [f.key, f.default]),
    );
    void loadPreview();
  }

  function onFieldInput(key: string, value: string) {
    fieldValues = { ...fieldValues, [key]: value };
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(() => void loadPreview(), 300);
  }

  async function loadPreview() {
    if (!selectedKey) return;
    previewLoading = true;
    try {
      const preview = await getAdminEmailPreview(selectedKey, fieldValues);
      previewSubject = preview.subject;
      previewHtml = preview.html;
      previewText = preview.text;
    } catch {
      previewSubject = null;
      previewHtml = null;
      previewText = null;
    } finally {
      previewLoading = false;
    }
  }

  async function copyHtml() {
    if (!previewHtml) return;
    await navigator.clipboard.writeText(previewHtml);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }

  async function sendTestEmail() {
    if (!selectedKey || !testTo) return;
    sendingEmail = true;
    sendResult = null;
    try {
      await sendAdminTestEmail(selectedKey, {
        to: testTo,
        values: fieldValues,
      });
      sendResult = { ok: true, message: `Envoyé à ${testTo}.` };
      toast.success(`Email envoyé à ${testTo}.`);
    } catch (err) {
      sendResult = {
        ok: false,
        message: err instanceof ApiError ? err.message : "Échec de l'envoi",
      };
    } finally {
      sendingEmail = false;
    }
  }

  $effect(() => {
    void loadEmails();
  });

  // ----------------------------------------------------------------- Push --

  let users = $state<AdminUserOptionDto[]>([]);
  let email = $state(page.url.searchParams.get("email") ?? "");
  let pushTitle = $state("");
  let pushBody = $state("");

  const userOptions = $derived(
    users.map((u) => ({
      label: `${u.displayName} <${u.email}>`,
      value: u.email,
    })),
  );

  let devices = $state<AdminPushDeviceDto[] | null>(null);
  let devicesLoading = $state(false);

  let sendingPush = $state(false);
  let pushResult = $state<AdminPushSendResponseDto | null>(null);
  let pushSendError = $state<string | null>(null);

  async function loadDevices() {
    if (!email) {
      devices = null;
      return;
    }
    devicesLoading = true;
    try {
      devices = await getAdminPushDevices(email);
    } catch {
      devices = null;
    } finally {
      devicesLoading = false;
    }
  }

  async function sendPush() {
    if (!email) return;
    sendingPush = true;
    pushSendError = null;
    pushResult = null;
    try {
      pushResult = await sendAdminTestPush({
        email,
        title: pushTitle.trim() || undefined,
        body: pushBody.trim() || undefined,
      });
      await loadDevices();
      await refreshCounts();
    } catch (err) {
      pushSendError =
        err instanceof ApiError ? err.message : "Échec de l'envoi";
    } finally {
      sendingPush = false;
    }
  }

  $effect(() => {
    getAdminUserOptions()
      .then((u) => (users = u))
      .catch(() => {});
  });

  $effect(() => {
    void email;
    pushResult = null;
    pushSendError = null;
    void loadDevices();
  });

  // Instance-wide push reach. Also feeds the broadcast section's "portée
  // actuelle", which used to read the same two numbers off /admin/overview —
  // one source now, so the header and the warning can't disagree.
  let pushSummary = $state<AdminPushSummaryDto | null>(null);

  async function refreshCounts() {
    try {
      pushSummary = await getAdminPushSummary();
    } catch {
      pushSummary = null;
    }
  }

  $effect(() => {
    void refreshCounts();
  });

  const accountCount = $derived(pushSummary?.accounts ?? null);
  const deviceCount = $derived(pushSummary?.subscriptions ?? null);

  const nf = new Intl.NumberFormat("fr-FR");

  const pushKpis = $derived(
    pushSummary
      ? [
          {
            value: nf.format(pushSummary.subscriptions),
            label: "Abonnements actifs",
          },
          { value: nf.format(pushSummary.accounts), label: "Comptes abonnés" },
        ]
      : [],
  );

  const userAgentBars = $derived(
    (pushSummary?.byUserAgent ?? []).map((u) => ({
      label: u.label,
      value: u.count,
    })),
  );

  let broadcastTitle = $state("");
  let broadcastBody = $state("");
  let showBroadcastConfirm = $state(false);
  let broadcasting = $state(false);
  let broadcastResult = $state<AdminPushBroadcastResponseDto | null>(null);
  let broadcastError = $state<string | null>(null);

  function openBroadcastConfirm() {
    broadcastResult = null;
    broadcastError = null;
    showBroadcastConfirm = true;
  }

  async function confirmBroadcast() {
    broadcasting = true;
    broadcastError = null;
    try {
      broadcastResult = await sendAdminBroadcastPush({
        title: broadcastTitle.trim() || undefined,
        body: broadcastBody.trim() || undefined,
      });
      showBroadcastConfirm = false;
    } catch (err) {
      broadcastError =
        err instanceof ApiError ? err.message : "Échec de la diffusion";
      showBroadcastConfirm = false;
    } finally {
      broadcasting = false;
    }
  }
</script>

<div class="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="mail"
    title="Communications"
    subtitle="Aperçu/envoi de gabarits email et notifications push, individuel ou en diffusion." />

  <div class="mb-6 flex gap-2">
    <button
      type="button"
      class="chip"
      class:chip-on={tab === "email"}
      onclick={() => (tab = "email")}>
      Email
    </button>
    <button
      type="button"
      class="chip"
      class:chip-on={tab === "push"}
      onclick={() => (tab = "push")}>
      Push
    </button>
  </div>

  {#if tab === "email"}
    {#if emailLoadError}
      <Banner variant="error">{emailLoadError}</Banner>
    {:else if emailLoading}
      <div class="card h-96 animate-pulse"></div>
    {:else if templates}
      {#if !smtpConfigured}
        <Banner variant="warning" class="mb-6">
          SMTP n'est pas configuré — l'aperçu fonctionne, mais l'envoi de test
          est désactivé.
        </Banner>
      {/if}

      <div class="grid gap-6 md:grid-cols-[220px_1fr]">
        <div>
          <!-- Mobile: a dropdown instead of an ugly horizontal scroll strip. -->
          <div class="md:hidden">
            <Combobox
              label="Gabarit"
              searchable
              options={templates.map((t) => ({
                label: t.label,
                value: t.key,
              }))}
              values={selectedKey ? [selectedKey] : []}
              onChange={(v) => v[0] && selectTemplate(v[0])} />
          </div>

          <!-- Desktop: the full vertical list. -->
          <nav class="hidden gap-1 md:flex md:flex-col">
            {#each templates as t (t.key)}
              <button
                onclick={() => selectTemplate(t.key)}
                class="rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors {selectedKey ===
                t.key
                  ? 'bg-accent/15 text-accent'
                  : 'text-dim hover:bg-surface-2 hover:text-fg'}">
                {t.label}
              </button>
            {/each}
          </nav>
        </div>

        <div class="min-w-0 space-y-4">
          {#if selectedTemplate && selectedTemplate.fields.length > 0}
            <div class="card grid gap-3 p-4 sm:grid-cols-2">
              {#each selectedTemplate.fields as f (f.key)}
                <div class={f.multiline ? "sm:col-span-2" : ""}>
                  <label
                    for="field-{f.key}"
                    class="text-dim mb-1 block text-xs font-semibold">
                    {f.label}
                  </label>
                  {#if f.multiline}
                    <textarea
                      id="field-{f.key}"
                      value={fieldValues[f.key] ?? f.default}
                      oninput={(e) =>
                        onFieldInput(f.key, e.currentTarget.value)}
                      rows="4"
                      class="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm"
                    ></textarea>
                  {:else}
                    <input
                      id="field-{f.key}"
                      type="text"
                      value={fieldValues[f.key] ?? f.default}
                      oninput={(e) =>
                        onFieldInput(f.key, e.currentTarget.value)}
                      class="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm" />
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <div class="flex items-center justify-between gap-2">
            <div class="flex gap-1">
              <button
                onclick={() => (previewTab = "html")}
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {previewTab ===
                'html'
                  ? 'bg-accent/15 text-accent'
                  : 'text-dim hover:bg-surface-2 hover:text-fg'}">
                HTML
              </button>
              <button
                onclick={() => (previewTab = "text")}
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {previewTab ===
                'text'
                  ? 'bg-accent/15 text-accent'
                  : 'text-dim hover:bg-surface-2 hover:text-fg'}">
                Texte brut
              </button>
            </div>
            <button
              onclick={copyHtml}
              disabled={!previewHtml}
              class="text-dim hover:bg-surface-2 hover:text-fg rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50">
              {copied ? "Copié !" : "Copier le HTML"}
            </button>
          </div>

          <div
            class="border-border bg-surface-2 overflow-hidden rounded-xl border">
            {#if previewLoading}
              <div class="h-96 animate-pulse"></div>
            {:else if previewTab === "html" && previewHtml}
              <iframe
                title="Aperçu de l'email"
                sandbox=""
                srcdoc={previewHtml}
                class="h-130 w-full border-0 bg-white"></iframe>
            {:else if previewTab === "text" && previewText}
              <pre
                class="bg-surface text-fg h-130 overflow-auto p-4 text-xs whitespace-pre-wrap">{previewSubject
                  ? `Sujet : ${previewSubject}\n\n`
                  : ""}{previewText}</pre>
            {:else}
              <div class="text-dim grid h-96 place-items-center text-sm">
                Aperçu indisponible.
              </div>
            {/if}
          </div>

          <div class="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <input
              type="email"
              bind:value={testTo}
              placeholder="destinataire@example.com"
              disabled={!smtpConfigured}
              class="border-border bg-surface min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-50" />
            <button
              onclick={sendTestEmail}
              disabled={!smtpConfigured || !testTo || sendingEmail}
              class="btn btn-primary shrink-0">
              {sendingEmail ? "Envoi…" : "Envoyer un test"}
            </button>
          </div>

          {#if sendResult}
            <p
              class="rounded-lg border px-4 py-3 text-sm {sendResult.ok
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-danger/40 bg-danger/10 text-danger'}">
              {sendResult.message}
            </p>
          {/if}
        </div>
      </div>
    {/if}
  {:else}
    {#if pushSummary}
      <div class="max-w-xl">
        <KpiStrip tiles={pushKpis} />
        {#if userAgentBars.length > 0}
          <div class="card mb-6 p-4">
            <!-- Active subscriptions only: a rejected one is deleted on send,
                 so there is no dead/alive ratio to show against it. -->
            <SectionLabel label="Appareils par navigateur" class="mb-3" />
            <RankBars items={userAgentBars} />
          </div>
        {/if}
      </div>
    {/if}

    <div class="max-w-xl">
      <section class="card mb-6 space-y-4 p-4 md:p-5">
        <h2 class="font-display text-lg font-bold">Test individuel</h2>
        <div>
          <span class="text-dim mb-1 block text-xs font-semibold">Compte</span>
          <Combobox
            label="Choisir un compte"
            options={userOptions}
            values={email ? [email] : []}
            searchable
            searchPlaceholder="Rechercher par nom ou email…"
            onChange={(v) => (email = v[0] ?? "")} />
        </div>

        <div>
          <label
            for="admin-push-title"
            class="text-dim mb-1 block text-xs font-semibold">
            Titre (optionnel)
          </label>
          <input
            id="admin-push-title"
            type="text"
            bind:value={pushTitle}
            placeholder="Loomkeep (admin)"
            maxlength="100"
            class="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm" />
        </div>

        <div>
          <label
            for="admin-push-body"
            class="text-dim mb-1 block text-xs font-semibold">
            Message (optionnel)
          </label>
          <textarea
            id="admin-push-body"
            bind:value={pushBody}
            placeholder="Ceci est une notification de test envoyée depuis le panel admin."
            maxlength="500"
            rows="2"
            class="border-border bg-surface w-full resize-none rounded-lg border px-3 py-2 text-sm"
          ></textarea>
        </div>

        {#if !devicesLoading && devices && devices.length === 0}
          <Banner variant="warning">
            Aucun appareil abonné pour ce compte — l'envoi n'atteindra personne.
          </Banner>
        {:else if devices && devices.length > 0}
          <div>
            <p class="text-dim mb-1.5 text-xs font-semibold">
              {devices.length} appareil{devices.length > 1 ? "s" : ""} abonné{devices.length >
              1
                ? "s"
                : ""}
            </p>
            <ul class="space-y-1">
              {#each devices as d (d.id)}
                <li
                  class="border-border text-dim truncate rounded-lg border px-3 py-1.5 text-xs">
                  {d.userAgent ?? "Appareil inconnu"}
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <button
          onclick={sendPush}
          disabled={!email || sendingPush}
          class="btn btn-primary">
          {sendingPush ? "Envoi…" : "Envoyer un test"}
        </button>

        {#if pushSendError}
          <Banner variant="error">{pushSendError}</Banner>
        {:else if pushResult}
          {#if pushResult.subscriptionCount === 0}
            <Banner variant="warning">
              Aucun appareil abonné — rien n'a été envoyé.
            </Banner>
          {:else}
            <div class="space-y-2">
              {#each pushResult.results as r, i (i)}
                <p
                  class="rounded-lg border px-4 py-2 text-sm {r.ok
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-danger/40 bg-danger/10 text-danger'}">
                  {r.userAgent ?? "Appareil inconnu"} —
                  {r.ok ? "envoyé" : (r.error ?? "échec")}
                </p>
              {/each}
            </div>
          {/if}
        {/if}
      </section>

      <section class="card border-accent/40 space-y-4 p-4 md:p-5">
        <div>
          <h2 class="font-display text-lg font-bold">Diffusion générale</h2>
          <p class="text-dim mt-1 text-sm">
            Envoie le même message à tous les appareils abonnés, tous comptes
            confondus.
            {#if accountCount !== null && deviceCount !== null}
              Portée actuelle : <strong class="text-fg">{accountCount}</strong>
              compte{accountCount > 1 ? "s" : ""} /
              <strong class="text-fg">{deviceCount}</strong>
              appareil{deviceCount > 1 ? "s" : ""}.
            {/if}
          </p>
        </div>

        <div>
          <label
            for="admin-broadcast-title"
            class="text-dim mb-1 block text-xs font-semibold">
            Titre (optionnel)
          </label>
          <input
            id="admin-broadcast-title"
            type="text"
            bind:value={broadcastTitle}
            placeholder="Loomkeep (admin)"
            maxlength="100"
            class="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm" />
        </div>

        <div>
          <label
            for="admin-broadcast-body"
            class="text-dim mb-1 block text-xs font-semibold">
            Message (optionnel)
          </label>
          <textarea
            id="admin-broadcast-body"
            bind:value={broadcastBody}
            placeholder="Message envoyé à tous les comptes depuis le panel admin."
            maxlength="500"
            rows="2"
            class="border-border bg-surface w-full resize-none rounded-lg border px-3 py-2 text-sm"
          ></textarea>
        </div>

        <button
          onclick={openBroadcastConfirm}
          disabled={!accountCount}
          class="btn btn-primary">
          Diffuser à tous les comptes
        </button>

        {#if broadcastError}
          <Banner variant="error">{broadcastError}</Banner>
        {:else if broadcastResult}
          <Banner
            variant={broadcastResult.failureCount === 0 ? "info" : "warning"}>
            Diffusé à {broadcastResult.accountCount} compte{broadcastResult.accountCount >
            1
              ? "s"
              : ""}
            — {broadcastResult.successCount} appareil{broadcastResult.successCount >
            1
              ? "s"
              : ""} atteint{broadcastResult.successCount > 1 ? "s" : ""}
            {#if broadcastResult.failureCount > 0}
              , {broadcastResult.failureCount} échec{broadcastResult.failureCount >
              1
                ? "s"
                : ""}
            {/if}.
          </Banner>
        {/if}
      </section>
    </div>
  {/if}
</div>

{#if showBroadcastConfirm}
  <ConfirmationModal
    title="Diffuser à tous les comptes ?"
    message={`Cette notification sera envoyée à ${accountCount ?? 0} compte${(accountCount ?? 0) > 1 ? "s" : ""} (${deviceCount ?? 0} appareil${(deviceCount ?? 0) > 1 ? "s" : ""}). Cette action ne peut pas être annulée une fois lancée.`}
    confirmLabel="Diffuser"
    danger
    busy={broadcasting}
    onConfirm={confirmBroadcast}
    onCancel={() => (showBroadcastConfirm = false)} />
{/if}
