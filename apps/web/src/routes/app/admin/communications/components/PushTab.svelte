<script lang="ts">
  import { page } from "$app/state";
  import {
    getAdminPushDevices,
    getAdminPushSummary,
    getAdminUserOptions,
    sendAdminBroadcastPush,
    sendAdminTestPush,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import KpiStrip from "$lib/components/stats/KpiStrip.svelte";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import SectionLabel from "$lib/components/stats/SectionLabel.svelte";
  import { formatNumber } from "$lib/format";
  import { m } from "$lib/paraglide/messages";

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
      <Banner variant={broadcastResult.failureCount === 0 ? "info" : "warning"}>
        {m.admin_broadcast_result({
          accounts: broadcastResult.accountCount,
          reached: broadcastResult.successCount,
          failed: broadcastResult.failureCount,
        })}
      </Banner>
    {/if}
  </section>
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
