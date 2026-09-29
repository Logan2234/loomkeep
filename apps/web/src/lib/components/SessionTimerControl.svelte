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
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { Domain, SessionTimerDto } from "@loomkeep/shared";
  import { slide } from "svelte/transition";
  import ConfirmationModal from "./ConfirmationModal.svelte";
  import Icon from "./Icon.svelte";

  let {
    domain,
    entryId,
    disabled = false,
    compact = false,
    onFinish,
  }: {
    domain: Extract<Domain, "GAMES" | "BOOKS">;
    entryId: string;
    disabled?: boolean;
    compact?: boolean;
    onFinish: (elapsedSeconds: number) => void;
  } = $props();

  const reduced = prefersReducedMotion();
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
    mutate: () => startSessionTimer({ domain, entryId }),
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
    transition:slide|global={{ duration: reduced ? 0 : 180 }}
    type="button"
    class="btn btn-ghost border-border border {compact
      ? 'px-3 text-sm'
      : 'w-full'}"
    disabled={disabled || startMut.loading}
    onclick={() => startMut.mutate()}>
    <Icon name="timer" class="h-4 w-4" />
    {m.session_timer_start()}
  </button>
{:else if isCurrentEntry}
  <div
    transition:slide|global={{ duration: reduced ? 0 : 220 }}
    class="border-accent/35 bg-accent/6 w-full basis-full rounded-xl border p-3">
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
          onclick={finish}>{m.common_finish()}</button>
        <button
          type="button"
          class="btn btn-ghost"
          aria-label={m.session_timer_cancel()}
          onclick={() => (confirmCancel = true)}>×</button>
      </div>
    </div>
  </div>
{:else}
  <p
    transition:slide|global={{ duration: reduced ? 0 : 180 }}
    class="border-border text-dim w-full basis-full rounded-xl border px-3 py-2.5 text-sm">
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
