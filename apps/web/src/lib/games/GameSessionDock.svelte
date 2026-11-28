<script lang="ts">
  // A game's session dock: SessionDock, plus the time against the average
  // playthrough, the completion estimate and the Steam playtime.
  import {
    type CreateGameSessionDto,
    type GameEntryDto,
    type GamePlaythroughDto,
    type GameSessionDto,
    type GameSessionSummaryDto,
    type UpdateGameSessionDto,
  } from "@loomkeep/shared/contracts";
  import type { QueryKey } from "@tanstack/svelte-query";
  import { fade } from "svelte/transition";

  import {
    createGameSession,
    deleteGameSession,
    getGameSessions,
    updateGameSession,
  } from "#lib/api/games.js";
  import { keys } from "#lib/api/keys.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { SessionDomain } from "#lib/sessions/session-domain.js";
  import { formatSessionMinutes } from "#lib/sessions/session-presentation.js";
  import SessionDock from "#lib/sessions/SessionDock.svelte";
  import { DATETIME_NUMERIC_OPTIONS, formatDate } from "#lib/ui/format.js";
  import Icon from "#lib/ui/Icon.svelte";
  import { prefersReducedMotion } from "#lib/ui/motion.js";
  import ProgressBar from "#lib/ui/ProgressBar.svelte";
  import Tooltip from "#lib/ui/Tooltip.svelte";
  import ProviderMark from "#lib/work/ProviderMark.svelte";

  let {
    entry,
    detailKey,
    averageMinutes = null,
  }: {
    entry: GameEntryDto;
    detailKey: QueryKey;
    /** A normal playthrough's length, from the time-to-beat averages. */
    averageMinutes?: number | null;
  } = $props();

  const reduced = prefersReducedMotion();

  const domain: SessionDomain<
    GameSessionDto,
    GamePlaythroughDto,
    GameSessionSummaryDto,
    CreateGameSessionDto,
    UpdateGameSessionDto
  > = {
    timerDomain: "GAMES",
    doneStatus: "COMPLETED",
    quickDurations: [15, 30, 60, 120],
    defaultDuration: 60,
    durationRequired: true,
    emptyArt: "controller",
    keys: {
      root: keys.games.sessionsRoot,
      page: keys.games.sessions,
      stats: keys.stats.games,
    },
    api: {
      list: getGameSessions,
      create: createGameSession,
      update: updateGameSession,
      remove: deleteGameSession,
    },
    cycleNumber: (session) => session.playthroughNumber,
    activeCycle: (summary) => summary.activePlaythrough,
    restoreBody: () => ({}),
    messages: {
      addShort: m.game_session_add_short,
      addTitle: m.game_session_add_title,
      notesPlaceholder: m.game_session_notes_placeholder,
      historyDescription: (count) =>
        count === 1
          ? m.game_session_history_grouped_one()
          : m.game_session_history_grouped_many({ count }),
      historyItem: (session) =>
        session.playthroughNumber === null
          ? m.game_session_history_standalone()
          : m.game_session_history_item(),
      cycle: (number) => m.game_cycle_current({ number }),
      completed: (count) =>
        count === 1
          ? m.game_cycle_completed_one()
          : m.game_cycle_completed_many({ count }),
      completedDetail: (playthrough) =>
        m.game_cycle_completed_detail({
          number: playthrough.number,
          duration: formatSessionMinutes(playthrough.trackedMinutes),
        }),
      restart: m.session_cycle_restart_game,
      restartHelp: m.session_cycle_restart_game_help,
      continue: m.session_cycle_continue_game,
      continueHelp: m.session_cycle_continue_game_help,
      historyOnlyHelp: m.session_cycle_history_only_game_help,
    },
  };

  const steamDetails = $derived(
    `${m.game_session_steam_explainer()}${
      entry.steamSyncedAt
        ? `\n${m.game_session_steam_synced({
            date: formatDate(entry.steamSyncedAt, DATETIME_NUMERIC_OPTIONS),
          })}`
        : ""
    }`,
  );
</script>

<SessionDock
  {domain}
  {entry}
  cycles={entry.playthroughs}
  trackedMinutes={entry.trackedPlaytimeMinutes}
  {detailKey}>
  {#snippet progress({ titleId, summary, cycle })}
    {#if (summary?.totalSessions ?? 0) > 0}
      {@const tracked = cycle?.trackedMinutes ?? 0}
      <div class="flex flex-col gap-1.5">
        <p class="flex flex-wrap items-baseline gap-x-2">
          <span
            id={titleId}
            class="font-display text-lg font-extrabold tabular-nums">
            {formatSessionMinutes(tracked)}
          </span>
          <span class="text-dim text-sm">
            {m.game_session_played({
              cycle: m.game_cycle_current({ number: cycle?.number ?? 1 }),
            })}
          </span>
        </p>
        {#if averageMinutes && cycle?.status === "ACTIVE"}
          <ProgressBar
            value={Math.min(100, (tracked / averageMinutes) * 100)}
            label={m.common_progress()} />
          <p class="text-dim text-xs">
            {m.game_session_time_left({
              average: formatSessionMinutes(averageMinutes),
              left: formatSessionMinutes(Math.max(0, averageMinutes - tracked)),
            })}
          </p>
        {/if}
        {#if entry.status === "PLAYING" && summary?.estimatedCompletionDate}
          <p
            class="text-dim text-xs"
            transition:fade={{ duration: reduced ? 0 : 200 }}>
            {m.completion_estimate_finish({
              date: formatDate(`${summary.estimatedCompletionDate}T12:00:00`),
            })}
          </p>
        {/if}
      </div>
    {:else}
      <h3 id={titleId} class="sr-only">{m.game_session_add_short()}</h3>
    {/if}
  {/snippet}

  {#snippet historyLead({ cycle })}
    <p class="text-dim text-xs">{m.session_cycle_current_total()}</p>
    <p
      class="font-display mt-1 text-4xl leading-none font-extrabold tabular-nums sm:text-5xl">
      {formatSessionMinutes(cycle?.trackedMinutes ?? 0)}
    </p>
    <p class="text-dim mt-3 max-w-sm text-xs leading-relaxed">
      {m.game_cycle_explainer()}
    </p>
  {/snippet}

  {#snippet historyStats({ summary, cycle })}
    <dl class="border-border mt-5 grid grid-cols-1 border-y sm:grid-cols-3">
      <div class="border-border px-1 py-3 sm:border-r sm:px-4">
        <dt class="text-dim text-xs">{m.game_cycle_sessions()}</dt>
        <dd class="font-display mt-1 text-lg font-bold tabular-nums">
          {cycle?.sessionCount ?? 0}
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
          <ProviderMark brand="steam" decorative class="h-3.5 w-3.5 shrink-0" />
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
  {/snippet}
</SessionDock>
