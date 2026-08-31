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
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import KpiStrip from "$lib/components/stats/KpiStrip.svelte";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import SectionLabel from "$lib/components/stats/SectionLabel.svelte";
  import { formatNumber } from "$lib/format";
  import {
    adminTemplateLabel,
    adminTemplateFieldLabel,
  } from "$lib/constants/admin-presentation";
  import { m } from "$lib/paraglide/messages";

  type Tab = "email" | "push";
  let tab = $state<Tab>(
    page.url.searchParams.get("tab") === "push" ? "push" : "email",
  );

  // ---------------------------------------------------------------- Email --

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
  let previewDebounce: ReturnType<typeof setTimeout> | undefined;

  let testTo = $state("");

  function selectTemplate(key: string) {
    selectedKey = key;
    sendTestEmailMut.reset();
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

  const sendTestEmailMut = createApiMutation(() => ({
    mutate: () =>
      sendAdminTestEmail(selectedKey!, { to: testTo, values: fieldValues }),
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

  // ----------------------------------------------------------------- Push --

  let email = $state(page.url.searchParams.get("email") ?? "");
  let pushTitle = $state("");
  let pushBody = $state("");

  const usersQuery = createApiQuery(() => ({
    key: keys.admin.userOptions(),
    fetch: getAdminUserOptions,
  }));
  const userOptions = $derived(
    (usersQuery.data ?? []).map((u) => ({
      label: `${u.displayName} <${u.email}>`,
      value: u.email,
    })),
  );

  const devicesQuery = createApiQuery(() => ({
    key: keys.admin.pushDevices(email),
    fetch: () => getAdminPushDevices(email),
    enabled: !!email,
  }));
  const devices = $derived(email ? (devicesQuery.data ?? null) : null);
  const devicesLoading = $derived(devicesQuery.loading);

  const sendPushMut = createApiMutation(() => ({
    mutate: () =>
      sendAdminTestPush({
        email,
        title: pushTitle.trim() || undefined,
        body: pushBody.trim() || undefined,
      }),
    coveredFields: ["email", "title", "body"],
    invalidates: [keys.admin.pushDevices(email), keys.admin.pushSummary()],
  }));

  function sendPush() {
    if (!email) return;
    sendPushMut.mutate();
  }

  const pushResult = $derived(sendPushMut.data ?? null);
  const pushSendError = $derived(sendPushMut.error);

  $effect(() => {
    // Starting a new attempt (or switching accounts) drops the last result.
    void email;
    sendPushMut.reset();
  });

  // Instance-wide push reach. Also feeds the broadcast section's "portée
  // actuelle", which used to read the same two numbers off /admin/overview —
  // one source now, so the header and the warning can't disagree.
  const pushSummaryQuery = createApiQuery(() => ({
    key: keys.admin.pushSummary(),
    fetch: getAdminPushSummary,
  }));
  const pushSummary = $derived(pushSummaryQuery.data ?? null);

  const accountCount = $derived(pushSummary?.accounts ?? null);
  const deviceCount = $derived(pushSummary?.subscriptions ?? null);

  const pushKpis = $derived(
    pushSummary
      ? [
          {
            value: formatNumber(pushSummary.subscriptions),
            label: m.admin_communications_active_subscriptions(),
          },
          {
            value: formatNumber(pushSummary.accounts),
            label: m.admin_communications_subscribed_accounts(),
          },
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

  const broadcastMut = createApiMutation(() => ({
    mutate: () =>
      sendAdminBroadcastPush({
        title: broadcastTitle.trim() || undefined,
        body: broadcastBody.trim() || undefined,
      }),
    coveredFields: ["title", "body"],
    invalidates: [keys.admin.pushSummary()],
    // Closes either way — a failure's banner shows on the page, not the modal.
    onSuccess: () => (showBroadcastConfirm = false),
    onError: () => (showBroadcastConfirm = false),
  }));

  function openBroadcastConfirm() {
    broadcastMut.reset();
    showBroadcastConfirm = true;
  }

  function confirmBroadcast() {
    broadcastMut.mutate();
  }

  const broadcastResult = $derived(broadcastMut.data ?? null);
  const broadcastError = $derived(broadcastMut.error);
</script>

<div class="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="mail"
    title={m.settings_section_communications()}
    subtitle={m.admin_communications_subtitle()} />

  <div class="mb-6 flex gap-2">
    <button
      type="button"
      class="chip"
      class:chip-on={tab === "email"}
      onclick={() => (tab = "email")}>
      {m.common_email()}
    </button>
    <button
      type="button"
      class="chip"
      class:chip-on={tab === "push"}
      onclick={() => (tab = "push")}>
      {m.admin_communications_push()}
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
                      oninput={(e) =>
                        onFieldInput(f.key, e.currentTarget.value)}
                      rows="4"
                      class="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm"
                    ></textarea>
                  {:else}
                    <input
                      id="field-{f.key}"
                      type="text"
                      name={f.key}
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

          <div
            class="border-border bg-surface-2 overflow-hidden rounded-xl border">
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
  {:else}
    {#if pushSummary}
      <div class="max-w-xl">
        <KpiStrip tiles={pushKpis} />
        {#if userAgentBars.length > 0}
          <div class="card mb-6 p-4">
            <!-- Active subscriptions only: a rejected one is deleted on send,
                 so there is no dead/alive ratio to show against it. -->
            <SectionLabel
              label={m.admin_communications_devices_browser()}
              class="mb-3" />
            <RankBars items={userAgentBars} />
          </div>
        {/if}
      </div>
    {/if}

    <div class="max-w-xl">
      <section class="card mb-6 space-y-4 p-4 md:p-5">
        <h2 class="font-display text-lg font-bold">
          {m.admin_communications_individual_test()}
        </h2>
        <div>
          <span class="text-dim mb-1 block text-xs font-semibold"
            >{m.common_account()}</span>
          <Combobox
            label={m.admin_communications_choose_account()}
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
            {m.common_title()}
            {m.common_optional_parentheses()}
          </label>
          <input
            id="admin-push-title"
            type="text"
            name="pushTitle"
            bind:value={pushTitle}
            placeholder="Loomkeep (admin)"
            maxlength="100"
            class="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm" />
        </div>

        <div>
          <label
            for="admin-push-body"
            class="text-dim mb-1 block text-xs font-semibold">
            {m.admin_communications_optional_message()}
          </label>
          <textarea
            id="admin-push-body"
            name="pushBody"
            bind:value={pushBody}
            placeholder={m.admin_communications_test_placeholder()}
            maxlength="500"
            rows="2"
            class="border-border bg-surface w-full resize-none rounded-lg border px-3 py-2 text-sm"
          ></textarea>
        </div>

        {#if !devicesLoading && devices && devices.length === 0}
          <Banner variant="warning">
            {m.admin_communications_no_devices_account()}
          </Banner>
        {:else if devices && devices.length > 0}
          <div>
            <p class="text-dim mb-1.5 text-xs font-semibold">
              {devices.length === 1
                ? m.admin_subscribed_device_one({ count: devices.length })
                : m.admin_subscribed_device_many({ count: devices.length })}
            </p>
            <ul class="space-y-1">
              {#each devices as d (d.id)}
                <li
                  class="border-border text-dim truncate rounded-lg border px-3 py-1.5 text-xs">
                  {d.userAgent ?? m.settings_sessions_unknown_device()}
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <button
          onclick={sendPush}
          disabled={!email || sendPushMut.loading}
          class="btn btn-primary">
          {sendPushMut.loading
            ? m.common_sending()
            : m.admin_communications_send_test()}
        </button>

        {#if pushSendError}
          <Banner variant="error">{pushSendError}</Banner>
        {:else if pushResult}
          {#if pushResult.subscriptionCount === 0}
            <Banner variant="warning">
              {m.admin_communications_nothing_sent()}
            </Banner>
          {:else}
            <div class="space-y-2">
              {#each pushResult.results as r, i (i)}
                <p
                  class="rounded-lg border px-4 py-2 text-sm {r.ok
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-danger/40 bg-danger/10 text-danger'}">
                  {r.userAgent ?? m.settings_sessions_unknown_device()} —
                  {r.ok
                    ? m.admin_communications_sent()
                    : (r.error ?? m.admin_communications_failed())}
                </p>
              {/each}
            </div>
          {/if}
        {/if}
      </section>

      <section class="card border-accent/40 space-y-4 p-4 md:p-5">
        <div>
          <h2 class="font-display text-lg font-bold">
            {m.admin_communications_broadcast()}
          </h2>
          <p class="text-dim mt-1 text-sm">
            {m.admin_communications_broadcast_description()}
            {#if accountCount !== null && deviceCount !== null}
              {m.admin_communications_current_reach()}
              <strong class="text-fg">{accountCount}</strong>
              {accountCount === 1
                ? m.admin_account_singular()
                : m.admin_accounts_plural()} /
              <strong class="text-fg">{deviceCount}</strong>
              {deviceCount === 1
                ? m.admin_device_singular()
                : m.admin_devices_plural()}.
            {/if}
          </p>
        </div>

        <div>
          <label
            for="admin-broadcast-title"
            class="text-dim mb-1 block text-xs font-semibold">
            {m.common_title()}
            {m.common_optional_parentheses()}
          </label>
          <input
            id="admin-broadcast-title"
            type="text"
            name="broadcastTitle"
            bind:value={broadcastTitle}
            placeholder="Loomkeep (admin)"
            maxlength="100"
            class="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm" />
        </div>

        <div>
          <label
            for="admin-broadcast-body"
            class="text-dim mb-1 block text-xs font-semibold">
            {m.admin_communications_optional_message()}
          </label>
          <textarea
            id="admin-broadcast-body"
            name="broadcastBody"
            bind:value={broadcastBody}
            placeholder={m.admin_communications_broadcast_placeholder()}
            maxlength="500"
            rows="2"
            class="border-border bg-surface w-full resize-none rounded-lg border px-3 py-2 text-sm"
          ></textarea>
        </div>

        <button
          onclick={openBroadcastConfirm}
          disabled={!accountCount}
          class="btn btn-primary">
          {m.admin_communications_broadcast_all()}
        </button>

        {#if broadcastError}
          <Banner variant="error">{broadcastError}</Banner>
        {:else if broadcastResult}
          <Banner
            variant={broadcastResult.failureCount === 0 ? "info" : "warning"}>
            {m.admin_broadcast_result({
              accounts: broadcastResult.accountCount,
              reached: broadcastResult.successCount,
              failed: broadcastResult.failureCount,
            })}
          </Banner>
        {/if}
      </section>
    </div>
  {/if}
</div>

{#if showBroadcastConfirm}
  <ConfirmationModal
    title={m.admin_communications_confirm_broadcast()}
    message={m.admin_communications_broadcast_message({
      accounts: accountCount ?? 0,
      devices: deviceCount ?? 0,
    })}
    confirmLabel={m.admin_communications_confirm_send()}
    danger
    busy={broadcastMut.loading}
    onConfirm={confirmBroadcast}
    onCancel={() => (showBroadcastConfirm = false)} />
{/if}
