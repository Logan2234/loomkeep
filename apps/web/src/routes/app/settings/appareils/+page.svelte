<script lang="ts">
  import { page } from "$app/state";
  import {
    getSessions,
    revokeOtherSessions,
    revokeSession,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import CardRowSkeleton from "$lib/components/CardRowSkeleton.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import RelativeTime from "$lib/components/RelativeTime.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { deviceLabel, type SessionDto } from "@loomkeep/shared";
  import { flashAnchor } from "../flash-anchor";
  import SettingsSection from "../components/SettingsSection.svelte";

  const sessionsQuery = createApiQuery(() => ({
    key: keys.sessions.all(),
    fetch: getSessions,
  }));
  // This device first, then the rest by last activity: spotting the one you
  // don't recognise is a comparison, and it only works from a fixed anchor.
  const sessions = $derived(
    [...(sessionsQuery.data ?? [])].sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return (
        new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
      );
    }),
  );
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
        : revokeOtherSessions(),
    invalidates: [keys.sessions.all()],
    onSuccess: () => (confirmTarget = null),
  }));

  function confirmRevoke() {
    if (!confirmTarget) return;
    revokeMut.mutate();
  }

  let hasOthers = $derived(sessions.some((s) => !s.isCurrent));
</script>

<SettingsSection slug="appareils">
  {#if loading}
    <CardRowSkeleton count={3} />
  {:else if error}
    <p class="text-danger text-sm">{error}</p>
  {:else}
    <div class="card divide-border divide-y">
      {#each sessions as session (session.id)}
        {@const isCurrent = session.isCurrent}
        <div
          class="flex items-center gap-4 p-4 {isCurrent
            ? 'border-l-accent border-l-2'
            : ''}">
          <Icon
            name="monitor"
            class="h-6 w-6 shrink-0 {isCurrent ? 'text-accent' : 'text-dim'}" />
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
              <RelativeTime iso={session.lastUsedAt} class="timecode" />
            </p>
          </div>
          {#if !isCurrent}
            <button
              class="btn-text text-danger hover:text-danger shrink-0 text-sm"
              onclick={() => (confirmTarget = { kind: "one", session })}>
              {m.settings_sessions_disconnect()}
            </button>
          {/if}
        </div>
      {/each}
    </div>

    {#if hasOthers}
      <div
        id="sessions-revoke-all"
        use:flashAnchor={{ anchor: "sessions-revoke-all", hash: page.url.hash }}
        class="mt-5 rounded-lg">
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
</SettingsSection>
