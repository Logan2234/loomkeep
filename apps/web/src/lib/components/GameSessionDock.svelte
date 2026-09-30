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
  import { DATETIME_NUMERIC_OPTIONS, formatDate } from "$lib/format";
  import { isFeatureNew } from "$lib/feature-badges";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import {
    formatSessionMinutes,
    localDateInput,
    MAX_SESSION_DURATION_MINUTES,
    sessionDateToIso,
  } from "$lib/session-presentation";
  import { toast } from "$lib/toast.svelte";
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
  import Switch from "./Switch.svelte";
  import Tooltip from "./Tooltip.svelte";
  import TrackingStatusBadge from "./TrackingStatusBadge.svelte";

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
  let historyDirection = $state(1);
  let editingId = $state<string | null>(null);
  let editDuration = $state(0);
  let editDate = $state(today);
  let editNotes = $state("");
  let deletingId = $state<string | null>(null);
  let finishingTimer = $state(false);
  let linkToPlaythrough = $state(true);
  let restartDropped = $state(false);

  const sessionKey = $derived(keys.games.sessions(entry.id, page));
  const sessionsQuery = createApiQuery(() => ({
    key: sessionKey,
    fetch: () => getGameSessions(entry.id, page),
  }));
  const summary = $derived(sessionsQuery.data);
  const totalSessions = $derived(summary?.totalSessions ?? 0);
  const activePlaythrough = $derived(summary?.activePlaythrough ?? null);
  const completedPlaythroughs = $derived(
    entry.playthroughs.filter(
      (playthrough) => playthrough.status === "COMPLETED",
    ),
  );
  const lastFinishedPlaythrough = $derived(
    entry.playthroughs.find((playthrough) => playthrough.status !== "ACTIVE") ??
      null,
  );
  const displayedPlaythrough = $derived(
    activePlaythrough ??
      entry.playthroughs.find(
        (playthrough) => playthrough.status === "ACTIVE",
      ) ??
      lastFinishedPlaythrough,
  );
  const displayedPlaythroughIsActive = $derived(
    displayedPlaythrough?.status === "ACTIVE",
  );
  const steamDetails = $derived(
    `${m.game_session_steam_explainer()}${
      entry.steamSyncedAt
        ? `\n${m.game_session_steam_synced({
            date: formatDate(entry.steamSyncedAt, DATETIME_NUMERIC_OPTIONS),
          })}`
        : ""
    }`,
  );
  const historyGroups = $derived.by(() => {
    const groups: {
      key: string;
      label: string;
      sessions: GameSessionDto[];
      totalMinutes: number;
    }[] = [];
    const groupsByKey = new Map<string, (typeof groups)[number]>();
    for (const session of summary?.items ?? []) {
      const key = String(session.playthroughNumber ?? "standalone");
      const existing = groupsByKey.get(key);
      if (!existing) {
        const group = {
          key,
          label: historyGroupLabel(session),
          sessions: [session],
          totalMinutes: session.durationMinutes,
        };
        groups.push(group);
        groupsByKey.set(key, group);
      } else {
        existing.sessions.push(session);
        existing.totalMinutes += session.durationMinutes;
      }
    }
    return groups;
  });

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

  function historyDescription(count: number): string {
    return count === 1
      ? m.game_session_history_grouped_one()
      : m.game_session_history_grouped_many({ count });
  }

  function historyItemTitle(session: GameSessionDto): string {
    return session.playthroughNumber === null
      ? m.game_session_history_standalone()
      : m.game_session_history_item();
  }

  function historyGroupLabel(session: GameSessionDto): string {
    return session.playthroughNumber === null
      ? m.session_cycle_standalone()
      : m.game_cycle_current({ number: session.playthroughNumber });
  }

  function submit() {
    if (durationMinutes < 1) return;
    const cycleAction = !linkToPlaythrough
      ? ("HISTORY_ONLY" as const)
      : entry.status === "COMPLETED" || restartDropped
        ? ("RESTART" as const)
        : entry.status === "DROPPED"
          ? ("CONTINUE" as const)
          : undefined;
    if (finishingTimer) {
      finishTimerMut.mutate({
        notes: notes || null,
        cycleAction,
      });
      return;
    }
    createMut.mutate({
      durationMinutes,
      occurredAt: sessionDateToIso(occurredOn),
      notes: notes || null,
      cycleAction,
    });
  }

  function openAdd() {
    finishingTimer = false;
    linkToPlaythrough = true;
    restartDropped = false;
    showAdd = true;
  }

  function finishTimedSession(elapsedSeconds: number) {
    durationMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
    notes = "";
    linkToPlaythrough = true;
    restartDropped = false;
    finishingTimer = true;
    showAdd = true;
  }

  function openHistory() {
    page = 1;
    historyDirection = 1;
    editingId = null;
    showHistory = true;
  }

  function changeHistoryPage(nextPage: number) {
    historyDirection = nextPage > page ? 1 : -1;
    editingId = null;
    page = nextPage;
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

<section aria-labelledby="game-session-title">
  <article class="border-border bg-bg/45 overflow-hidden rounded-2xl border">
    <div class="p-4 sm:p-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-dim text-sm">
            {displayedPlaythroughIsActive
              ? m.game_cycle_current_label()
              : m.game_cycle_last_label()}
          </p>
          <h3
            id="game-session-title"
            class="font-display mt-0.5 text-xl font-bold">
            {m.game_cycle_current({
              number: displayedPlaythrough?.number ?? 1,
            })}
          </h3>
          {#if displayedPlaythrough?.startedAt}
            <p class="text-dim mt-1 text-xs">
              {m.session_cycle_started({
                date: formatDate(displayedPlaythrough.startedAt),
              })}
            </p>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          {#if isFeatureNew("sessions")}<NewBadge />{/if}
          <TrackingStatusBadge domain="GAMES" status={entry.status} />
        </div>
      </header>

      <div
        class="mt-5 grid gap-6 lg:grid-cols-[minmax(13rem,0.85fr)_minmax(20rem,1.15fr)] lg:items-end">
        <div>
          <p class="text-dim text-xs">{m.session_cycle_current_total()}</p>
          <p
            class="font-display mt-1 text-4xl leading-none font-extrabold tabular-nums sm:text-5xl">
            {formatSessionMinutes(displayedPlaythrough?.trackedMinutes ?? 0)}
          </p>
          <p class="text-dim mt-3 max-w-sm text-xs leading-relaxed">
            {m.game_cycle_explainer()}
          </p>
        </div>

        <div>
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h4 class="font-display font-bold">{m.common_this_week()}</h4>
            <p class="text-dim text-xs tabular-nums">
              {weeklySummary(
                summary?.weekSessions ?? 0,
                summary?.weekMinutes ?? 0,
              )}
            </p>
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
      </div>

      <dl class="border-border mt-5 grid grid-cols-1 border-y sm:grid-cols-3">
        <div class="border-border px-1 py-3 sm:border-r sm:px-4">
          <dt class="text-dim text-xs">{m.game_cycle_sessions()}</dt>
          <dd class="font-display mt-1 text-lg font-bold tabular-nums">
            {displayedPlaythrough?.sessionCount ?? 0}
          </dd>
        </div>
        <div
          class="border-border border-t px-1 py-3 sm:border-t-0 sm:border-r sm:px-4">
          <dt class="text-dim text-xs">{m.game_session_manual_total()}</dt>
          <dd class="font-display mt-1 text-lg font-bold tabular-nums">
            {formatSessionMinutes(
              summary?.totalTrackedMinutes ?? entry.trackedPlaytimeMinutes,
            )}
          </dd>
        </div>
        <div class="border-border border-t px-1 py-3 sm:border-t-0 sm:px-4">
          <dt class="text-dim flex items-center gap-1.5 text-xs">
            <span>{m.game_session_steam_total()}</span>
            <Tooltip text={steamDetails} class="inline-flex">
              <button
                type="button"
                class="text-dim hover:text-fg focus-visible:ring-accent grid h-5 w-5 place-items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
                aria-label={`${m.common_details()} — ${m.game_session_steam_total()}`}>
                <Icon name="info" class="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </dt>
          <dd class="font-display mt-1 text-lg font-bold tabular-nums">
            {entry.steamPlaytimeMinutes === null
              ? "—"
              : formatSessionMinutes(entry.steamPlaytimeMinutes)}
          </dd>
        </div>
      </dl>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-primary" onclick={openAdd}>
            <Icon name="plus" class="h-4 w-4" />
            {m.game_session_add_short()}
          </button>
          <SessionTimerControl
            domain="GAMES"
            entryId={entry.id}
            compact
            onFinish={finishTimedSession} />
        </div>
      </div>
    </div>

    <footer
      class="border-border bg-surface/55 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
      {#if completedPlaythroughs.length > 0}
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="bg-success/12 text-success grid h-9 w-9 shrink-0 place-items-center rounded-full">
            <Icon name="check" class="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <p class="text-sm font-semibold">
              {completedPlaythroughs.length === 1
                ? m.game_cycle_completed_one()
                : m.game_cycle_completed_many({
                    count: completedPlaythroughs.length,
                  })}
            </p>
            <p class="text-dim truncate text-xs">
              {m.game_cycle_completed_detail({
                number: completedPlaythroughs[0]!.number,
                duration: formatSessionMinutes(
                  completedPlaythroughs[0]!.trackedMinutes,
                ),
              })}
            </p>
          </div>
        </div>
      {:else if lastFinishedPlaythrough?.status === "DROPPED"}
        <p class="text-dim text-xs">
          {m.game_cycle_current({ number: lastFinishedPlaythrough.number })} ·
          {m.session_cycle_dropped()}
        </p>
      {/if}
      <button
        type="button"
        class="text-dim hover:text-accent ml-auto text-sm font-semibold underline decoration-current/40 underline-offset-4 transition-colors disabled:cursor-default disabled:opacity-50"
        disabled={totalSessions === 0}
        onclick={openHistory}>
        {historyLabel(totalSessions)}
      </button>
    </footer>
  </article>
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

      {#if entry.status === "DROPPED" || entry.status === "COMPLETED"}
        <div
          class="border-border bg-bg/55 mt-4 flex items-center justify-between gap-4 rounded-xl border p-3.5">
          <div class="min-w-0">
            <p class="text-sm font-semibold">
              {entry.status === "COMPLETED"
                ? m.session_cycle_restart_game()
                : restartDropped
                  ? m.session_cycle_restart_game()
                  : m.session_cycle_continue_game()}
            </p>
            <p class="text-dim mt-0.5 text-xs leading-relaxed">
              {linkToPlaythrough
                ? entry.status === "COMPLETED" || restartDropped
                  ? m.session_cycle_restart_game_help()
                  : m.session_cycle_continue_game_help()
                : m.session_cycle_history_only_game_help()}
            </p>
            {#if entry.status === "DROPPED" && linkToPlaythrough}
              <button
                type="button"
                class="link-accent mt-2 text-xs"
                onclick={() => (restartDropped = !restartDropped)}>
                {restartDropped
                  ? m.session_cycle_continue_instead()
                  : m.session_cycle_restart_instead()}
              </button>
            {/if}
          </div>
          <Switch
            checked={linkToPlaythrough}
            onChange={(checked) => (linkToPlaythrough = checked)}
            label={entry.status === "COMPLETED"
              ? m.session_cycle_restart_game()
              : m.session_cycle_continue_game()} />
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
    title={m.game_session_history_title()}
    description={historyDescription(totalSessions)}
    wide
    onclose={() => (showHistory = false)}>
    {#if sessionsQuery.error}
      <Banner variant="error">{sessionsQuery.error}</Banner>
    {:else if summary?.items.length}
      {#key page}
        <div
          in:fly|global={{
            x: reduced ? 0 : historyDirection * 28,
            duration: reduced ? 0 : 220,
          }}
          out:fly|global={{
            x: reduced ? 0 : historyDirection * -28,
            duration: reduced ? 0 : 180,
          }}
          class="space-y-3">
          {#each historyGroups as group, groupIndex (group.key)}
            <section
              in:fly|global={{
                y: reduced ? 0 : 10,
                duration: reduced ? 0 : 220,
                delay: reduced ? 0 : Math.min(groupIndex * 55, 165),
              }}
              class="border-border bg-bg/35 overflow-hidden rounded-xl border">
              <header
                class="border-border bg-surface/70 flex items-center justify-between gap-3 border-b px-4 py-2.5">
                <div class="flex items-center gap-2.5">
                  <span
                    class="bg-accent h-5 w-1 rounded-full"
                    aria-hidden="true"></span>
                  <h4 class="text-sm font-bold">{group.label}</h4>
                </div>
                <p class="text-dim text-xs tabular-nums">
                  {weeklySummary(group.sessions.length, group.totalMinutes)}
                </p>
              </header>
              <ol
                class="before:bg-border relative before:absolute before:top-5 before:bottom-5 before:left-5 before:w-px">
                {#each group.sessions as session (session.id)}
                  <li
                    class="border-border group relative border-b py-4 pr-3 pl-10 last:border-b-0 sm:pr-4">
                    <span
                      class="bg-accent ring-bg absolute top-[1.35rem] left-4 h-2.5 w-2.5 rounded-full ring-4"
                      aria-hidden="true"></span>
                    {#if editingId === session.id}
                      <div
                        class="border-border bg-surface/60 min-w-0 rounded-xl border p-3">
                        <div class="grid gap-3 sm:grid-cols-2">
                          <label
                            class="flex flex-col gap-1.5 text-xs font-semibold">
                            <span>{m.session_duration()}</span>
                            <span class="relative">
                              <AnimatedNumberInput
                                bind:value={editDuration}
                                label={m.session_duration()}
                                min={1}
                                max={MAX_SESSION_DURATION_MINUTES}
                                class="border-border bg-bg h-11 w-full"
                                numberClass="text-base" />
                              <span
                                class="text-dim pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold">
                                {m.common_minutes_short()}
                              </span>
                            </span>
                          </label>
                          <label
                            class="flex flex-col gap-1.5 text-xs font-semibold">
                            <span>{m.session_date()}</span>
                            <input
                              class="input"
                              type="date"
                              max={today}
                              bind:value={editDate} />
                          </label>
                        </div>
                        <label
                          class="mt-3 flex flex-col gap-1.5 text-xs font-semibold">
                          <span>
                            {m.session_notes()}
                            <span class="text-dim font-normal"
                              >{m.common_optional_marker()}</span>
                          </span>
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
                      </div>
                    {:else}
                      <div
                        class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:gap-x-5">
                        <time
                          class="text-dim col-span-2 mb-1 text-xs tabular-nums sm:col-span-1 sm:mb-0">
                          {formatDate(session.occurredAt)}
                        </time>
                        <div class="min-w-0">
                          <p class="text-sm font-semibold">
                            {historyItemTitle(session)}
                          </p>
                          {#if session.notes}
                            <p
                              class="text-dim mt-1 text-sm leading-relaxed whitespace-pre-line">
                              « {session.notes} »
                            </p>
                          {/if}
                        </div>
                        <div class="flex items-start gap-2">
                          <span
                            class="font-display pt-0.5 text-sm font-bold tabular-nums">
                            {formatSessionMinutes(session.durationMinutes)}
                          </span>
                          <div
                            class="flex opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                            <button
                              type="button"
                              class="text-dim hover:bg-surface-2 hover:text-fg rounded-lg p-1.5 transition-colors"
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
                      </div>
                    {/if}
                  </li>
                {/each}
              </ol>
            </section>
          {/each}
        </div>
      {/key}
      {#if page > 1 || summary.hasMore}
        <div class="mt-3 flex justify-between gap-2">
          <button
            type="button"
            class="btn-text text-xs"
            disabled={page === 1}
            onclick={() => changeHistoryPage(page - 1)}
            >← {m.session_previous()}</button>
          <button
            type="button"
            class="btn-text text-xs"
            disabled={!summary.hasMore}
            onclick={() => changeHistoryPage(page + 1)}
            >{m.session_next()} →</button>
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
