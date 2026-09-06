<script lang="ts">
  import type { Locale } from "@loomkeep/shared";
  import {
    getAdminEmailPreview,
    getAdminEmailTemplates,
    sendAdminTestEmail,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import {
    adminTemplateLabel,
    adminTemplateFieldLabel,
  } from "$lib/constants/admin-presentation";
  import { debounce } from "$lib/debounce";
  import { m } from "$lib/paraglide/messages";
  import { getLocale } from "$lib/paraglide/runtime";

  const emailLocales: Locale[] = ["fr", "en"];

  const templatesQuery = createApiQuery(() => ({
    key: keys.admin.emailTemplates(),
    fetch: getAdminEmailTemplates,
  }));
  const templates = $derived(templatesQuery.data?.templates ?? null);
  const smtpConfigured = $derived(templatesQuery.data?.smtpConfigured ?? false);
  const emailLoading = $derived(templatesQuery.loading);
  const emailLoadError = $derived(templatesQuery.error);

  let selectedKey = $state<string | null>(null);
  // Auto-select the first template once the list lands.
  $effect(() => {
    if (selectedKey === null && templates && templates.length > 0) {
      selectTemplate(templates[0].key);
    }
  });
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

  let testTo = $state("");
  let emailLocale = $state<Locale>(getLocale());

  function selectTemplate(key: string) {
    selectedKey = key;
    sendTestEmailMut.reset();
    const template = templates?.find((t) => t.key === key);
    fieldValues = Object.fromEntries(
      (template?.fields ?? []).map((f) => [f.key, f.default]),
    );
    void loadPreview();
  }

  const debouncedLoadPreview = debounce(() => void loadPreview(), 300);

  function onFieldInput(key: string, value: string) {
    fieldValues = { ...fieldValues, [key]: value };
    debouncedLoadPreview.call();
  }

  async function loadPreview() {
    if (!selectedKey) return;
    previewLoading = true;
    try {
      const preview = await getAdminEmailPreview(
        selectedKey,
        emailLocale,
        fieldValues,
      );
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

  const sendTestEmailMut = createApiMutation(() => ({
    mutate: () =>
      sendAdminTestEmail(selectedKey!, {
        to: testTo,
        locale: emailLocale,
        values: fieldValues,
      }),
    coveredFields: ["to"],
    successToast: () => m.admin_communications_email_sent_to({ email: testTo }),
  }));

  function sendTestEmail() {
    if (!selectedKey || !testTo) return;
    sendTestEmailMut.mutate();
  }

  const sendResult = $derived(
    sendTestEmailMut.error
      ? { ok: false, message: sendTestEmailMut.error }
      : sendTestEmailMut.data
        ? {
            ok: true,
            message: m.admin_communications_sent_to({ email: testTo }),
          }
        : null,
  );
</script>

{#if emailLoadError}
  <Banner variant="error">{emailLoadError}</Banner>
{:else if emailLoading}
  <div class="card h-96 animate-pulse"></div>
{:else if templates}
  {#if !smtpConfigured}
    <Banner variant="warning" class="mb-6">
      {m.admin_communications_smtp_unavailable()}
    </Banner>
  {/if}

  <div class="grid gap-6 md:grid-cols-[220px_1fr]">
    <div>
      <!-- Mobile: a dropdown instead of an ugly horizontal scroll strip. -->
      <div class="md:hidden">
        <Combobox
          label={m.admin_communications_template()}
          searchable
          options={templates.map((t) => ({
            label: adminTemplateLabel(t.key),
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
            {adminTemplateLabel(t.key)}
          </button>
        {/each}
      </nav>
    </div>

    <div class="min-w-0 space-y-4">
      <div class="flex items-center gap-3">
        <span class="text-dim text-xs font-semibold"
          >{m.common_language()}</span>
        <div class="flex gap-1">
          {#each emailLocales as locale (locale)}
            <button
              type="button"
              class="chip"
              class:chip-on={emailLocale === locale}
              onclick={() => {
                emailLocale = locale;
                void loadPreview();
              }}>
              {locale === "fr"
                ? m.common_language_fr()
                : m.common_language_en()}
            </button>
          {/each}
        </div>
      </div>

      {#if selectedTemplate && selectedTemplate.fields.length > 0}
        <div class="card grid gap-3 p-4 sm:grid-cols-2">
          {#each selectedTemplate.fields as f (f.key)}
            <div class={f.multiline ? "sm:col-span-2" : ""}>
              <label
                for="field-{f.key}"
                class="text-dim mb-1 block text-xs font-semibold">
                {adminTemplateFieldLabel(f.key)}
              </label>
              {#if f.multiline}
                <textarea
                  id="field-{f.key}"
                  name={f.key}
                  value={fieldValues[f.key] ?? f.default}
                  oninput={(e) => onFieldInput(f.key, e.currentTarget.value)}
                  rows="4"
                  class="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm"
                ></textarea>
              {:else}
                <input
                  id="field-{f.key}"
                  type="text"
                  name={f.key}
                  value={fieldValues[f.key] ?? f.default}
                  oninput={(e) => onFieldInput(f.key, e.currentTarget.value)}
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
            {m.admin_communications_plain_text()}
          </button>
        </div>
        <button
          onclick={copyHtml}
          disabled={!previewHtml}
          class="text-dim hover:bg-surface-2 hover:text-fg rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50">
          {copied
            ? `${m.common_copied()} !`
            : m.admin_communications_copy_html()}
        </button>
      </div>

      <div class="border-border bg-surface-2 overflow-hidden rounded-xl border">
        {#if previewLoading}
          <div class="h-96 animate-pulse"></div>
        {:else if previewTab === "html" && previewHtml}
          <iframe
            title={m.admin_communications_email_preview()}
            sandbox=""
            srcdoc={previewHtml}
            class="h-130 w-full border-0 bg-white"></iframe>
        {:else if previewTab === "text" && previewText}
          <pre
            class="bg-surface text-fg h-130 overflow-auto p-4 text-xs whitespace-pre-wrap">{previewSubject
              ? m.admin_communications_subject({ subject: previewSubject })
              : ""}{previewText}</pre>
        {:else}
          <div class="text-dim grid h-96 place-items-center text-sm">
            {m.admin_communications_preview_unavailable()}
          </div>
        {/if}
      </div>

      <div class="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          type="email"
          name="testTo"
          autocomplete="email"
          enterkeyhint="send"
          bind:value={testTo}
          placeholder={m.admin_communications_recipient_placeholder()}
          disabled={!smtpConfigured}
          class="border-border bg-surface min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-50" />
        <button
          onclick={sendTestEmail}
          disabled={!smtpConfigured || !testTo || sendTestEmailMut.loading}
          class="btn btn-primary shrink-0">
          {sendTestEmailMut.loading
            ? m.common_sending()
            : m.admin_communications_send_test()}
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
