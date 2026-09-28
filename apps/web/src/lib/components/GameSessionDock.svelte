<script lang="ts">
  import {
    createGameSession,
    deleteGameSession,
    getGameSessions,
    updateGameSession,
  } from "$lib/api/games";
  import { finishSessionTimer } from "$lib/api/session-timer";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { formatDate } from "$lib/format";
  import { isFeatureNew } from "$lib/feature-badges";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import {
    formatSessionMinutes,
    localDateInput,
    sessionDateToIso,
  } from "$lib/session-presentation";
  import { toast } from "$lib/toast.svelte";
  import { MAX_SESSION_DURATION_MINUTES } from "@loomkeep/shared";
  import type {
    CreateGameSessionDto,
    FinishSessionTimerDto,
    GameEntryDto,
    GameSessionDto,
    GameSessionMutationDto,
    UpdateGameSessionDto,
  } from "@loomkeep/shared";
  import type { QueryKey } from "@tanstack/svelte-query";
  import { fly } from "svelte/transition";
  import Banner from "./Banner.svelte";
  import AnimatedNumberInput from "./AnimatedNumberInput.svelte";
  import ConfirmationModal from "./ConfirmationModal.svelte";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";
  import NewBadge from "./NewBadge.svelte";
  import SessionDurationPicker from "./SessionDurationPicker.svelte";
  import SessionTimerControl from "./SessionTimerControl.svelte";
  import SessionWeekChart from "./SessionWeekChart.svelte";

  let { entry, detailKey }: { entry: GameEntryDto; detailKey: QueryKey } =
    $props();

  const quickDurations = [15, 30, 60, 120] as const;
  const today = localDateInput();
  const reduced = prefersReducedMotion();
  let durationMinutes = $state(60);
  let occurredOn = $state(today);
  let notes = $state("");
  let page = $state(1);
  let showAdd = $state(false);
  let showHistory = $state(false);
  let editingId = $state<string | null>(null);
  let editDuration = $state(0);
  let editDate = $state(today);
  let editNotes = $state("");
  let deletingId = $state<string | null>(null);
  let finishingTimer = $state(false);
  let resumeTracking = $state(true);

  const sessionKey = $derived(keys.games.sessions(entry.id, page));
  const sessionsQuery = createApiQuery(() => ({
    key: sessionKey,
    fetch: () => getGameSessions(entry.id, page),
  }));
  const summary = $derived(sessionsQuery.data);
  const totalSessions = $derived(summary?.totalSessions ?? 0);

  const createMut = createApiMutation<
    CreateGameSessionDto,
    GameSessionMutationDto
  >(() => ({
    mutate: (body) => createGameSession(entry.id, body),
    invalidates: [
      keys.games.sessionsRoot(entry.id),
      detailKey,
      keys.stats.games(),
      keys.stats.social(),
      keys.gamification.progression(),
      keys.feed.all(),
    ],
    onSuccess: () => {
      page = 1;
      notes = "";
      showAdd = false;
    },
    successToast: m.session_saved(),
    errorToast: true,
  }));

  const finishTimerMut = createApiMutation<FinishSessionTimerDto, void>(() => ({
    mutate: finishSessionTimer,
    invalidates: [
      keys.sessionTimer.current(),
      keys.games.sessionsRoot(entry.id),
      detailKey,
      keys.stats.games(),
      keys.stats.social(),
      keys.gamification.progression(),
      keys.feed.all(),
    ],
    onSuccess: () => {
      page = 1;
      notes = "";
      finishingTimer = false;
      showAdd = false;
    },
    successToast: m.session_timer_saved(),
    errorToast: true,
  }));

  const updateMut = createApiMutation<
    { id: string; body: UpdateGameSessionDto },
    GameSessionMutationDto
  >(() => ({
    mutate: ({ id, body }) => updateGameSession(id, body),
    invalidates: [
      keys.games.sessionsRoot(entry.id),
      detailKey,
      keys.stats.games(),
      keys.stats.social(),
      keys.feed.all(),
    ],
    onSuccess: () => (editingId = null),
    successToast: m.session_saved(),
    errorToast: true,
  }));

  const restoreMut = createApiMutation<
    CreateGameSessionDto,
    GameSessionMutationDto
  >(() => ({
    mutate: (body) => createGameSession(entry.id, body),
    invalidates: [
      keys.games.sessionsRoot(entry.id),
      detailKey,
      keys.stats.games(),
      keys.stats.social(),
      keys.gamification.progression(),
      keys.feed.all(),
    ],
    onSuccess: () => (page = 1),
    successToast: m.session_restored(),
    errorToast: true,
  }));

  const deleteMut = createApiMutation<string, void>(() => ({
    mutate: (id) => deleteGameSession(id),
    invalidates: [
      keys.games.sessionsRoot(entry.id),
      detailKey,
      keys.stats.games(),
      keys.stats.social(),
      keys.gamification.progression(),
      keys.feed.all(),
    ],
    onSuccess: (_, deletedId) => {
      const deleted = summary?.items.find(
        (session) => session.id === deletedId,
      );
      deletingId = null;
      page = 1;
      if (deleted) {
        toast.action(
          m.session_deleted(),
          {
            label: m.common_undo(),
            onSelect: () =>
              restoreMut.mutate({
                durationMinutes: deleted.durationMinutes,
                occurredAt: deleted.occurredAt,
                notes: deleted.notes,
              }),
          },
          "success",
        );
      }
    },
    errorToast: true,
  }));

  function weeklySummary(count: number, minutes: number): string {
    const duration = formatSessionMinutes(minutes);
    return count === 1
      ? m.session_week_summary_one({ duration })
      : m.session_week_summary_many({ count, duration });
  }

  function historyLabel(count: number): string {
    return count === 1 ? m.session_view_one() : m.session_view_many({ count });
  }

  function submit() {
    if (durationMinutes < 1) return;
    if (finishingTimer) {
      finishTimerMut.mutate({ notes: notes || null });
      return;
    }
    createMut.mutate({
      durationMinutes,
      occurredAt: sessionDateToIso(occurredOn),
      notes: notes || null,
      resumeTracking: entry.status === "DROPPED" && resumeTracking,
    });
  }

  function openAdd() {
    finishingTimer = false;
    showAdd = true;
  }

  function finishTimedSession(elapsedSeconds: number) {
    durationMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
    notes = "";
    finishingTimer = true;
    showAdd = true;
  }

  function openHistory() {
    page = 1;
    editingId = null;
    showHistory = true;
  }

  function beginEdit(session: GameSessionDto) {
    editingId = session.id;
    editDuration = session.durationMinutes;
    editDate = localDateInput(new Date(session.occurredAt));
    editNotes = session.notes ?? "";
  }

  function saveEdit(id: string) {
    if (editDuration < 1) return;
    updateMut.mutate({
      id,
      body: {
        durationMinutes: editDuration,
        occurredAt: sessionDateToIso(editDate),
        notes: editNotes || null,
      },
    });
  }
</script>

<section class="space-y-3" aria-labelledby="game-session-title">
  <div class="border-border bg-bg/45 rounded-xl border p-4">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h3 id="game-session-title" class="font-display font-bold">
            {m.session_week()}
          </h3>
          {#if isFeatureNew("sessions")}<NewBadge />{/if}
        </div>
        <p class="text-dim mt-1 text-sm tabular-nums">
          {weeklySummary(summary?.weekSessions ?? 0, summary?.weekMinutes ?? 0)}
        </p>
      </div>
      <button type="button" class="btn btn-primary shrink-0" onclick={openAdd}>
        <Icon name="plus" class="h-4 w-4" />
        {m.game_session_add_short()}
      </button>
    </div>

    {#if sessionsQuery.error}
      <div class="mt-4">
        <Banner variant="error">{sessionsQuery.error}</Banner>
      </div>
    {:else if summary}
      <SessionWeekChart days={summary.weekDays} />
    {:else}
      <div
        class="mt-4 grid h-20 grid-cols-7 items-end gap-2"
        aria-hidden="true">
        {#each Array(7) as _, i (i)}
          <span class="bg-surface-2 h-2 rounded-t-md"></span>
        {/each}
      </div>
    {/if}
  </div>

  {#if entry.status === "DROPPED"}
    <label
      class="border-border bg-bg/45 flex items-start gap-3 rounded-xl border p-3 text-sm">
      <input class="mt-0.5" type="checkbox" bind:checked={resumeTracking} />
      <span>
        <span class="font-semibold">{m.session_resume_tracking()}</span>
        <span class="text-dim mt-0.5 block text-xs">
          {m.session_resume_tracking_help()}
        </span>
      </span>
    </label>
  {:else if entry.status === "COMPLETED"}
    <Banner variant="info">{m.session_completed_notice()}</Banner>
  {/if}

  <SessionTimerControl
    domain="GAMES"
    entryId={entry.id}
    resumeTracking={entry.status === "DROPPED" && resumeTracking}
    onFinish={finishTimedSession} />

  <button
    type="button"
    class="border-border hover:border-accent/60 hover:text-accent font-display w-full rounded-xl border px-4 py-3 font-bold transition-colors disabled:cursor-default disabled:opacity-50"
    disabled={totalSessions === 0}
    onclick={openHistory}>
    {historyLabel(totalSessions)}
  </button>

  {#if entry.steamPlaytimeMinutes !== null}
    <div class="border-border bg-bg/45 rounded-xl border p-3.5">
      <div class="grid grid-cols-2 gap-2">
        <div class="bg-surface rounded-lg p-2.5">
          <p class="timecode text-[0.56rem] tracking-[0.14em] uppercase">
            {m.game_session_steam_total()}
          </p>
          <p class="font-display mt-1 font-bold tabular-nums">
            {formatSessionMinutes(entry.steamPlaytimeMinutes)}
          </p>
        </div>
        <div class="bg-surface rounded-lg p-2.5">
          <p class="timecode text-[0.56rem] tracking-[0.14em] uppercase">
            {m.game_session_manual_total()}
          </p>
          <p class="font-display mt-1 font-bold tabular-nums">
            {formatSessionMinutes(
              summary?.totalTrackedMinutes ?? entry.trackedPlaytimeMinutes,
            )}
          </p>
        </div>
      </div>
      <p class="text-dim mt-2 text-[0.7rem] leading-relaxed">
        {m.game_session_steam_explainer()}
      </p>
      {#if entry.steamSyncedAt}
        <p class="text-dim mt-1 text-[0.65rem]">
          {m.game_session_steam_synced({
            date: formatDate(entry.steamSyncedAt),
          })}
        </p>
      {/if}
    </div>
  {/if}
</section>

{#if showAdd}
  <Modal
    title={m.game_session_add_title()}
    onclose={() => {
      showAdd = false;
      finishingTimer = false;
    }}>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        submit();
      }}>
      <SessionDurationPicker
        bind:value={durationMinutes}
        {quickDurations}
        disabled={createMut.loading ||
          finishTimerMut.loading ||
          finishingTimer} />

      {#if entry.status === "DROPPED" && !finishingTimer}
        <label
          class="border-border mt-4 flex items-start gap-3 rounded-xl border p-3 text-sm">
          <input class="mt-0.5" type="checkbox" bind:checked={resumeTracking} />
          <span>
            <span class="font-semibold">{m.session_resume_tracking()}</span>
            <span class="text-dim mt-0.5 block text-xs">
              {m.session_resume_tracking_help()}
            </span>
          </span>
        </label>
      {:else if entry.status === "COMPLETED"}
        <div class="mt-4">
          <Banner variant="info">{m.session_completed_notice()}</Banner>
        </div>
      {/if}

      <label
        class="mt-4 flex flex-col gap-1.5 text-xs font-semibold {finishingTimer
          ? 'hidden'
          : ''}">
        {m.session_date()}
        <span class="relative">
          <Icon
            name="calendar"
            class="text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            class="input w-full pl-10"
            type="date"
            max={today}
            bind:value={occurredOn}
            disabled={createMut.loading || finishTimerMut.loading} />
        </span>
      </label>

      <label class="mt-4 flex flex-col gap-1.5 text-xs font-semibold">
        <span>
          {m.session_notes()}
          <span class="text-dim font-normal">{m.common_optional_marker()}</span>
        </span>
        <span class="relative">
          <textarea
            class="input min-h-28 w-full resize-y pb-7 leading-relaxed"
            maxlength="1000"
            placeholder={m.game_session_notes_placeholder()}
            bind:value={notes}
            disabled={createMut.loading || finishTimerMut.loading}></textarea>
          <span
            class="text-dim pointer-events-none absolute right-3 bottom-2 text-[0.65rem] tabular-nums">
            {notes.length} / 1000
          </span>
        </span>
      </label>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          disabled={createMut.loading || finishTimerMut.loading}
          onclick={() => {
            showAdd = false;
            finishingTimer = false;
          }}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={createMut.loading ||
            finishTimerMut.loading ||
            durationMinutes < 1 ||
            !occurredOn}>
          {m.session_save()}
        </button>
      </div>
    </form>
  </Modal>
{/if}

{#if showHistory}
  <Modal
    title={historyLabel(totalSessions)}
    wide
    onclose={() => (showHistory = false)}>
    {#if sessionsQuery.error}
      <Banner variant="error">{sessionsQuery.error}</Banner>
    {:else if summary?.items.length}
      <div class="grid grid-cols-2 gap-2">
        <div class="border-border bg-surface rounded-xl border p-3">
          <p
            class="timecode text-dim text-[0.58rem] tracking-[0.14em] uppercase">
            {m.session_total()}
          </p>
          <p class="font-display mt-1 text-lg font-bold tabular-nums">
            {formatSessionMinutes(summary.totalTrackedMinutes)}
          </p>
        </div>
        <div class="border-border bg-surface rounded-xl border p-3">
          <p
            class="timecode text-dim text-[0.58rem] tracking-[0.14em] uppercase">
            {m.session_month()}
          </p>
          <p class="font-display mt-1 text-lg font-bold tabular-nums">
            {formatSessionMinutes(summary.monthMinutes)}
          </p>
        </div>
      </div>

      <ol class="mt-4 flex flex-col gap-3">
        {#each summary.items as session, index (session.id)}
          <li
            in:fly|global={{
              y: reduced ? 0 : 8,
              duration: reduced ? 0 : 220,
              delay: reduced ? 0 : Math.min(index * 35, 175),
            }}
            class="border-border bg-surface group hover:border-accent/35 rounded-xl border p-3.5 transition-colors">
            {#if editingId === session.id}
              <div class="grid gap-2 sm:grid-cols-2">
                <AnimatedNumberInput
                  bind:value={editDuration}
                  label={m.session_duration()}
                  min={1}
                  max={MAX_SESSION_DURATION_MINUTES}
                  class="border-border bg-bg h-10 w-full"
                  numberClass="text-sm" />
                <input
                  class="input"
                  type="date"
                  max={today}
                  bind:value={editDate}
                  aria-label={m.session_date()} />
              </div>
              <label class="mt-2 block">
                <span class="sr-only">{m.session_notes()}</span>
                <textarea
                  class="input min-h-24 w-full resize-y"
                  maxlength="1000"
                  placeholder={m.game_session_notes_placeholder()}
                  bind:value={editNotes}></textarea>
              </label>
              <div class="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  class="btn btn-ghost text-xs"
                  onclick={() => (editingId = null)}>
                  {m.common_cancel()}
                </button>
                <button
                  type="button"
                  class="btn btn-primary text-xs"
                  disabled={updateMut.loading}
                  onclick={() => saveEdit(session.id)}>
                  {m.common_save()}
                </button>
              </div>
            {:else}
              <div class="flex items-start gap-3">
                <div
                  class="bg-accent/12 text-accent mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl">
                  <Icon name="gamepad" class="h-4 w-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="font-display text-base font-bold tabular-nums">
                        {formatSessionMinutes(session.durationMinutes)}
                      </p>
                      <p
                        class="text-dim mt-0.5 flex items-center gap-1.5 text-xs">
                        <Icon name="calendar" class="h-3.5 w-3.5" />
                        {formatDate(session.occurredAt)}
                      </p>
                    </div>
                    <div class="flex gap-1">
                      <button
                        type="button"
                        class="text-dim hover:bg-bg hover:text-fg rounded-lg p-1.5 transition-colors"
                        aria-label={m.session_edit()}
                        onclick={() => beginEdit(session)}>
                        <Icon name="edit" class="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        class="text-dim hover:bg-danger/10 hover:text-danger rounded-lg p-1.5 transition-colors"
                        aria-label={m.session_delete()}
                        onclick={() => (deletingId = session.id)}>
                        <Icon name="trash" class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {#if session.notes}
                    <p
                      class="border-border text-dim mt-3 border-l-2 pl-3 text-sm leading-relaxed whitespace-pre-line">
                      {session.notes}
                    </p>
                  {/if}
                </div>
              </div>
            {/if}
          </li>
        {/each}
      </ol>
      {#if page > 1 || summary.hasMore}
        <div class="mt-3 flex justify-between gap-2">
          <button
            type="button"
            class="btn-text text-xs"
            disabled={page === 1}
            onclick={() => page--}>← {m.session_previous()}</button>
          <button
            type="button"
            class="btn-text text-xs"
            disabled={!summary.hasMore}
            onclick={() => page++}>{m.session_next()} →</button>
        </div>
      {/if}
    {:else if !sessionsQuery.loading}
      <p class="text-dim text-sm">{m.session_history_empty()}</p>
    {/if}
  </Modal>
{/if}

{#if deletingId}
  <ConfirmationModal
    title={m.session_delete_title()}
    message={m.session_delete_message()}
    confirmLabel={m.common_delete()}
    danger
    busy={deleteMut.loading}
    onConfirm={() => deleteMut.mutate(deletingId!)}
    onCancel={() => (deletingId = null)} />
{/if}
