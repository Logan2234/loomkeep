<script lang="ts">
  import {
    cancelSessionTimer,
    getSessionTimer,
    pauseSessionTimer,
    resumeSessionTimer,
    startSessionTimer,
  } from "$lib/api/session-timer";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { Domain, SessionTimerDto } from "@loomkeep/shared";
  import ConfirmationModal from "./ConfirmationModal.svelte";

  let {
    domain,
    entryId,
    resumeTracking = false,
    disabled = false,
    onFinish,
  }: {
    domain: Extract<Domain, "GAMES" | "BOOKS">;
    entryId: string;
    resumeTracking?: boolean;
    disabled?: boolean;
    onFinish: (elapsedSeconds: number) => void;
  } = $props();

  let elapsedSeconds = $state(0);
  let confirmCancel = $state(false);
  const timerKey = keys.sessionTimer.current();
  const timerQuery = createApiQuery(() => ({
    key: timerKey,
    fetch: getSessionTimer,
  }));
  const timer = $derived(timerQuery.data as SessionTimerDto | null);
  const isCurrentEntry = $derived(
    timer?.domain === domain && timer.entryId === entryId,
  );

  $effect(() => {
    const current = timer;
    elapsedSeconds = current?.elapsedSeconds ?? 0;
    if (!current || current.pausedAt) return;
    const interval = window.setInterval(() => elapsedSeconds++, 1000);
    return () => window.clearInterval(interval);
  });

  const startMut = createApiMutation<void, SessionTimerDto>(() => ({
    mutate: () => startSessionTimer({ domain, entryId, resumeTracking }),
    invalidates: [timerKey],
    errorToast: true,
  }));
  const pauseMut = createApiMutation<void, SessionTimerDto>(() => ({
    mutate: pauseSessionTimer,
    invalidates: [timerKey],
    onSuccess: (paused) => onFinish(paused.elapsedSeconds),
    errorToast: true,
  }));
  const togglePauseMut = createApiMutation<boolean, SessionTimerDto>(() => ({
    mutate: (paused) => (paused ? resumeSessionTimer() : pauseSessionTimer()),
    invalidates: [timerKey],
    errorToast: true,
  }));
  const cancelMut = createApiMutation<void, void>(() => ({
    mutate: cancelSessionTimer,
    invalidates: [timerKey],
    onSuccess: () => (confirmCancel = false),
    errorToast: true,
  }));

  function finish() {
    if (!timer) return;
    if (timer.pausedAt) onFinish(elapsedSeconds);
    else pauseMut.mutate();
  }

  function formatClock(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
      : `${minutes}:${String(rest).padStart(2, "0")}`;
  }
</script>

{#if !timer}
  <button
    type="button"
    class="btn btn-ghost border-border w-full border"
    disabled={disabled || startMut.loading}
    onclick={() => startMut.mutate()}>
    {m.session_timer_start()}
  </button>
{:else if isCurrentEntry}
  <div class="border-accent/35 bg-accent/6 rounded-xl border p-3">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="timecode text-dim text-[0.58rem] tracking-[0.14em] uppercase">
          {timer.pausedAt
            ? m.session_timer_paused()
            : m.session_timer_running()}
        </p>
        <p class="font-display mt-1 text-2xl font-extrabold tabular-nums">
          {formatClock(elapsedSeconds)}
        </p>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          disabled={togglePauseMut.loading || pauseMut.loading}
          onclick={() => togglePauseMut.mutate(Boolean(timer.pausedAt))}>
          {timer.pausedAt ? m.session_timer_resume() : m.session_timer_pause()}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          disabled={pauseMut.loading}
          onclick={finish}>{m.session_timer_finish()}</button>
        <button
          type="button"
          class="btn btn-ghost"
          aria-label={m.session_timer_cancel()}
          onclick={() => (confirmCancel = true)}>×</button>
      </div>
    </div>
  </div>
{:else}
  <p class="border-border text-dim rounded-xl border px-3 py-2.5 text-sm">
    {m.session_timer_other_work()}
  </p>
{/if}

{#if confirmCancel}
  <ConfirmationModal
    title={m.session_timer_cancel_title()}
    message={m.session_timer_cancel_message()}
    confirmLabel={m.session_timer_cancel()}
    danger
    busy={cancelMut.loading}
    onConfirm={() => cancelMut.mutate()}
    onCancel={() => (confirmCancel = false)} />
{/if}
