<script lang="ts">
  import {
    getSessions,
    revokeOtherSessions,
    revokeSession,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { formatRelative } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import { deviceLabel, type SessionDto } from "@loomkeep/shared";

  // The device we're browsing from, so it's never offered for revocation.
  const currentJti = auth.currentSessionJti;

  const sessionsQuery = createApiQuery(() => ({
    key: keys.sessions.all(),
    fetch: getSessions,
  }));
  const sessions = $derived(sessionsQuery.data ?? []);
  const loading = $derived(sessionsQuery.loading);
  const error = $derived(sessionsQuery.error);

  // Confirmation modal, either for one session or for "all other devices".
  type Target =
    { kind: "one"; session: SessionDto } | { kind: "others" } | null;
  let confirmTarget = $state<Target>(null);

  const revokeMut = createApiMutation(() => ({
    mutate: () =>
      confirmTarget?.kind === "one"
        ? revokeSession(confirmTarget.session.id)
        : currentJti
          ? revokeOtherSessions(currentJti)
          : Promise.resolve(),
    invalidates: [keys.sessions.all()],
    onSuccess: () => (confirmTarget = null),
  }));

  function confirmRevoke() {
    if (!confirmTarget) return;
    revokeMut.mutate();
  }

  let hasOthers = $derived(sessions.some((s) => s.jti !== currentJti));
</script>

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    title={m.settings_sessions_title()}
    subtitle={m.settings_sessions_description()}
    icon="monitor"
    back="/app/settings" />

  {#if loading}
    <CardRowSkeleton count={3} />
  {:else if error}
    <p class="text-danger text-sm">{error}</p>
  {:else}
    <div class="card divide-border divide-y">
      {#each sessions as session (session.id)}
        {@const isCurrent = session.jti === currentJti}
        <div class="flex items-center gap-4 p-4">
          <Icon name="monitor" class="text-dim h-6 w-6 shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-2 font-semibold">
              <span class="truncate"
                >{deviceLabel(session.userAgent) ??
                  m.settings_sessions_unknown_device()}</span>
              {#if isCurrent}
                <span
                  class="bg-accent/15 text-accent rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  {m.settings_sessions_current_device()}
                </span>
              {/if}
            </p>
            <p class="text-dim text-sm">
              {m.common_active()}
              {formatRelative(session.lastUsedAt)}
            </p>
          </div>
          {#if !isCurrent}
            <button
              class="btn-text btn-text-underline text-danger shrink-0 text-sm"
              onclick={() => (confirmTarget = { kind: "one", session })}>
              {m.settings_sessions_disconnect()}
            </button>
          {/if}
        </div>
      {/each}
    </div>

    {#if hasOthers}
      <div class="mt-5">
        <button
          class="btn btn-danger"
          onclick={() => (confirmTarget = { kind: "others" })}>
          {m.settings_sessions_disconnect_all()}
        </button>
      </div>
    {/if}
  {/if}

  {#if confirmTarget}
    <Modal
      title={confirmTarget.kind === "others"
        ? m.settings_sessions_disconnect_others_title()
        : m.settings_sessions_disconnect_one_title()}
      onclose={() => (confirmTarget = null)}>
      <div class="flex flex-col gap-3">
        <p class="text-dim text-sm">
          {#if confirmTarget.kind === "others"}
            {m.settings_sessions_disconnect_others_description()}
          {:else}
            {m.settings_sessions_disconnect_one_description()}
          {/if}
        </p>
        {#if revokeMut.error}
          <p class="text-danger text-sm">{revokeMut.error}</p>
        {/if}
        <div class="mt-2 flex justify-end gap-2">
          <button
            type="button"
            class="btn btn-ghost"
            onclick={() => (confirmTarget = null)}>
            {m.common_cancel()}
          </button>
          <button
            type="button"
            class="btn btn-danger"
            disabled={revokeMut.loading}
            onclick={confirmRevoke}>
            {revokeMut.loading
              ? m.settings_sessions_disconnecting()
              : m.settings_sessions_disconnect()}
          </button>
        </div>
      </div>
    </Modal>
  {/if}
</div>
