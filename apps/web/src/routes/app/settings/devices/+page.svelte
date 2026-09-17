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
  import EmptyState from "$lib/components/EmptyState.svelte";
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
  const currentSession = $derived(
    sessions.find((session) => session.isCurrent),
  );
  const otherSessions = $derived(
    sessions.filter((session) => !session.isCurrent),
  );
</script>

<SettingsSection slug="devices">
  {#if loading}
    <CardRowSkeleton count={3} />
  {:else if error}
    <p class="text-danger text-sm">{error}</p>
  {:else}
    {#if currentSession}
      <section
        class="border-accent/50 bg-accent/5 mb-3 overflow-hidden rounded-xl border">
        <div class="border-l-accent flex items-center gap-4 border-l-2 p-4">
          <Icon name="monitor" class="text-accent h-6 w-6 shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-2 font-semibold">
              <span class="truncate"
                >{deviceLabel(currentSession.userAgent) ??
                  m.settings_sessions_unknown_device()}</span>
              <span
                class="bg-accent/15 text-accent rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {m.settings_sessions_current_device()}
              </span>
            </p>
            <p class="text-dim flex items-center gap-2 text-sm">
              <span>{m.common_active()}</span>
              <span aria-hidden="true" class="bg-dim h-1 w-1 rounded-full"
              ></span>
              <RelativeTime iso={currentSession.lastUsedAt} class="timecode" />
            </p>
          </div>
        </div>
      </section>
    {/if}

    {#if otherSessions.length > 0}
      <section class="card divide-border divide-y overflow-hidden">
        {#each otherSessions as session (session.id)}
          <div class="flex items-center gap-4 p-4">
            <Icon name="monitor" class="text-dim h-6 w-6 shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">
                {deviceLabel(session.userAgent) ??
                  m.settings_sessions_unknown_device()}
              </p>
              <p class="text-dim flex items-center gap-2 text-sm">
                <span>{m.common_active()}</span>
                <span aria-hidden="true" class="bg-dim h-1 w-1 rounded-full"
                ></span>
                <RelativeTime iso={session.lastUsedAt} class="timecode" />
              </p>
            </div>
            <button
              class="btn-text text-danger hover:text-danger shrink-0 text-sm"
              onclick={() => (confirmTarget = { kind: "one", session })}>
              {m.settings_sessions_disconnect()}
            </button>
          </div>
        {/each}
      </section>
    {:else if currentSession}
      <EmptyState class="mb-3 px-5 py-7">
        <p class="font-semibold">{m.settings_empty_devices_title()}</p>
        <p class="mt-1 text-sm">{m.settings_empty_devices_body()}</p>
      </EmptyState>
    {:else}
      <EmptyState class="px-5 py-9">
        <p class="font-semibold">{m.settings_empty_devices_title()}</p>
        <p class="mt-1 text-sm">{m.settings_empty_devices_body()}</p>
      </EmptyState>
    {/if}

    {#if hasOthers}
      <div
        id="sessions-revoke-all"
        use:flashAnchor={{ anchor: "sessions-revoke-all", hash: page.url.hash }}
        class="mt-3 rounded-lg">
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
