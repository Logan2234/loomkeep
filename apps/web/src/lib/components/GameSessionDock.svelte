<script lang="ts">
  import {
    createGameSession,
    deleteGameSession,
    getGameSessions,
    updateGameSession,
  } from "$lib/api/games";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import {
    formatSessionMinutes,
    localDateInput,
    sessionDateToIso,
  } from "$lib/session-presentation";
  import type {
    CreateGameSessionDto,
    GameEntryDto,
    GameSessionDto,
    GameSessionMutationDto,
    UpdateGameSessionDto,
  } from "@loomkeep/shared";
  import type { QueryKey } from "@tanstack/svelte-query";
  import Banner from "./Banner.svelte";
  import ConfirmationModal from "./ConfirmationModal.svelte";
  import Icon from "./Icon.svelte";

  let { entry, detailKey }: { entry: GameEntryDto; detailKey: QueryKey } =
    $props();

  const quickDurations = [15, 30, 60, 120] as const;
  const today = localDateInput();
  let durationMinutes = $state(60);
  let occurredOn = $state(today);
  let page = $state(1);
  let editingId = $state<string | null>(null);
  let editDuration = $state(0);
  let editDate = $state(today);
  let deletingId = $state<string | null>(null);
  let savedToday = $state(false);
  let totalPulse = $state(false);

  const sessionKey = $derived(keys.games.sessions(entry.id, page));
  const sessionsQuery = createApiQuery(() => ({
    key: sessionKey,
    fetch: () => getGameSessions(entry.id, page),
  }));
  const summary = $derived(sessionsQuery.data);

  function pulseTotal() {
    totalPulse = false;
    requestAnimationFrame(() => (totalPulse = true));
    setTimeout(() => (totalPulse = false), 650);
  }

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
    onSuccess: (_result, body) => {
      page = 1;
      savedToday = localDateInput(new Date(body.occurredAt)) === today;
      pulseTotal();
    },
    successToast: (result) =>
      result.xpAwarded ? m.session_saved_xp() : m.session_saved(),
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
    onSuccess: () => {
      editingId = null;
      pulseTotal();
    },
    successToast: m.session_saved(),
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
    onSuccess: () => {
      deletingId = null;
      pulseTotal();
    },
    successToast: m.session_deleted(),
    errorToast: true,
  }));

  function submit() {
    if (durationMinutes < 1) return;
    createMut.mutate({
      durationMinutes,
      occurredAt: sessionDateToIso(occurredOn),
    });
  }

  function beginEdit(session: GameSessionDto) {
    editingId = session.id;
    editDuration = session.durationMinutes;
    editDate = localDateInput(new Date(session.occurredAt));
  }

  function saveEdit(id: string) {
    if (editDuration < 1) return;
    updateMut.mutate({
      id,
      body: {
        durationMinutes: editDuration,
        occurredAt: sessionDateToIso(editDate),
      },
    });
  }
</script>

<section
  class="border-border bg-bg/45 rounded-xl border p-3.5"
  aria-labelledby="game-session-title">
  <div class="flex items-start justify-between gap-3">
    <div>
      <h3
        id="game-session-title"
        class="font-display flex items-center gap-2 font-bold">
        <span class="bg-accent/12 text-accent rounded-lg p-1.5">
          <Icon name="gamepad" class="h-4 w-4" />
        </span>
        {m.session_log_title()}
      </h3>
      <p class="text-dim mt-1 text-xs">{m.game_session_manual_total()}</p>
    </div>
    <div class="text-right" aria-live="polite">
      <p class="timecode text-[0.58rem] tracking-[0.16em] uppercase">
        {m.session_total()}
      </p>
      <p
        class="font-display text-xl font-extrabold tabular-nums {totalPulse
          ? 'total-pulse'
          : ''}">
        {formatSessionMinutes(
          summary?.totalTrackedMinutes ?? entry.trackedPlaytimeMinutes,
        )}
      </p>
    </div>
  </div>

  <div class="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr]">
    <label class="flex flex-col gap-1.5 text-xs font-semibold">
      {m.session_duration()}
      <span class="flex items-center gap-2">
        <input
          class="input min-w-0 flex-1"
          type="number"
          min="1"
          step="5"
          bind:value={durationMinutes}
          disabled={createMut.loading} />
        <span class="text-dim">{m.session_minutes_short()}</span>
      </span>
    </label>
    <label class="flex flex-col gap-1.5 text-xs font-semibold">
      {m.session_date()}
      <input
        class="input w-full"
        type="date"
        max={today}
        bind:value={occurredOn}
        disabled={createMut.loading} />
    </label>
  </div>

  <div class="mt-2.5 flex flex-wrap gap-1.5" aria-label={m.session_duration()}>
    {#each quickDurations as minutes (minutes)}
      <button
        type="button"
        class="rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors {durationMinutes ===
        minutes
          ? 'border-accent bg-accent/12 text-accent'
          : 'border-border text-dim hover:text-fg'}"
        aria-pressed={durationMinutes === minutes}
        onclick={() => (durationMinutes = minutes)}>
        {formatSessionMinutes(minutes)}
      </button>
    {/each}
  </div>

  <button
    type="button"
    class="btn btn-primary mt-3 w-full"
    disabled={createMut.loading || durationMinutes < 1 || !occurredOn}
    onclick={submit}>
    <Icon name="plus" class="h-4 w-4" />
    {m.session_save()}
  </button>

  {#if savedToday}
    <p class="text-accent mt-2 flex items-center gap-1.5 text-xs font-semibold">
      <Icon name="check" class="h-3.5 w-3.5" />
      {m.session_today_streak()}
    </p>
  {/if}

  {#if entry.steamPlaytimeMinutes !== null}
    <div class="border-border mt-4 border-t pt-3">
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

  {#if summary}
    <dl class="mt-4 grid grid-cols-2 gap-2">
      <div class="bg-surface rounded-lg p-2.5">
        <dt class="text-dim text-[0.68rem]">{m.session_week()}</dt>
        <dd class="font-display mt-0.5 font-bold tabular-nums">
          {formatSessionMinutes(summary.weekMinutes)}
        </dd>
      </div>
      <div class="bg-surface rounded-lg p-2.5">
        <dt class="text-dim text-[0.68rem]">{m.session_month()}</dt>
        <dd class="font-display mt-0.5 font-bold tabular-nums">
          {formatSessionMinutes(summary.monthMinutes)}
        </dd>
      </div>
    </dl>
  {/if}

  <div class="border-border mt-4 border-t pt-3">
    <h4 class="timecode text-[0.6rem] tracking-[0.16em] uppercase">
      {m.session_history()}
    </h4>
    {#if sessionsQuery.error}
      <div class="mt-2">
        <Banner variant="error">{sessionsQuery.error}</Banner>
      </div>
    {:else if summary?.items.length}
      <ul class="mt-2 flex flex-col gap-1.5">
        {#each summary.items as session (session.id)}
          <li class="bg-surface rounded-lg p-2.5">
            {#if editingId === session.id}
              <div class="grid gap-2 sm:grid-cols-2">
                <input
                  class="input"
                  type="number"
                  min="1"
                  bind:value={editDuration}
                  aria-label={m.session_duration()} />
                <input
                  class="input"
                  type="date"
                  max={today}
                  bind:value={editDate}
                  aria-label={m.session_date()} />
              </div>
              <div class="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  class="btn btn-ghost text-xs"
                  onclick={() => (editingId = null)}
                  >{m.common_cancel()}</button>
                <button
                  type="button"
                  class="btn btn-primary text-xs"
                  disabled={updateMut.loading}
                  onclick={() => saveEdit(session.id)}
                  >{m.common_save()}</button>
              </div>
            {:else}
              <div class="flex items-center gap-2">
                <div class="min-w-0 flex-1">
                  <p class="font-display text-sm font-bold tabular-nums">
                    {formatSessionMinutes(session.durationMinutes)}
                  </p>
                  <p class="text-dim text-xs">
                    {formatDate(session.occurredAt)}
                  </p>
                </div>
                <button
                  type="button"
                  class="text-dim hover:text-fg rounded p-1"
                  aria-label={m.session_edit()}
                  onclick={() => beginEdit(session)}>
                  <Icon name="edit" class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="text-dim hover:text-danger rounded p-1"
                  aria-label={m.session_delete()}
                  onclick={() => (deletingId = session.id)}>
                  <Icon name="trash" class="h-4 w-4" />
                </button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
      {#if page > 1 || summary.hasMore}
        <div class="mt-2 flex justify-between gap-2">
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
      <p class="text-dim mt-2 text-xs">{m.session_history_empty()}</p>
    {/if}
  </div>
</section>

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

<style>
  .total-pulse {
    animation: total-pulse 620ms cubic-bezier(0.2, 1.4, 0.4, 1);
  }

  @keyframes total-pulse {
    35% {
      color: var(--accent);
      transform: translateY(-2px) scale(1.06);
    }
  }
</style>
