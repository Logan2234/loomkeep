<script
  lang="ts"
  generics="S extends SessionLike, C extends CycleLike, Sum extends SessionSummaryLike<S>, Create extends CreateSessionLike, Update extends UpdateSessionLike">
  // The session dock of a book or a game: the button, the timer and the
  // "My sessions" sheet (week, history, edit, delete with undo). What only one
  // domain has (pages, Steam playtime) comes from its dock as snippets, and
  // its endpoints and wording from a `SessionDomain`.
  import {
    MAX_SESSION_DURATION_MINUTES,
    SESSION_NOTES_MAX_LENGTH,
    type FinishSessionTimerDto,
    timerMinutes,
  } from "@loomkeep/shared/contracts";
  import type { SessionCycleAction } from "@loomkeep/shared/enums";
  import type { QueryKey } from "@tanstack/svelte-query";
  import type { Snippet } from "svelte";
  import { fly } from "svelte/transition";

  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { finishSessionTimer } from "#lib/api/session-timer.js";
  import { m } from "#lib/paraglide/messages.js";
  import AnimatedNumberInput from "#lib/ui/AnimatedNumberInput.svelte";
  import Banner from "#lib/ui/Banner.svelte";
  import ConfirmationModal from "#lib/ui/ConfirmationModal.svelte";
  import EmptyState from "#lib/ui/EmptyState.svelte";
  import { formatDate } from "#lib/ui/format.js";
  import Icon from "#lib/ui/Icon.svelte";
  import Modal from "#lib/ui/Modal.svelte";
  import { prefersReducedMotion } from "#lib/ui/motion.js";
  import Switch from "#lib/ui/Switch.svelte";
  import { toast } from "#lib/ui/toast-store.svelte.js";
  import SessionDurationPicker from "./SessionDurationPicker.svelte";
  import {
    formatSessionMinutes,
    groupSessionsByCycle,
    localDateInput,
    sessionDateToIso,
  } from "./session-presentation.js";
  import SessionTimerControl from "./SessionTimerControl.svelte";
  import SessionWeekChart from "./SessionWeekChart.svelte";
  import type {
    CreateSessionLike,
    CycleLike,
    SessionDomain,
    SessionLike,
    SessionSummaryLike,
    TimerExtras,
    UpdateSessionLike,
  } from "./session-domain.js";

  let {
    domain,
    entry,
    cycles,
    trackedMinutes,
    detailKey,
    disabled = false,
    addExtras,
    addValid = true,
    editExtras,
    onBeginEdit,
    progress,
    addFields,
    editFields,
    historyLead,
    historyStats,
    notice,
  }: {
    domain: SessionDomain<S, C, Sum, Create, Update>;
    entry: { id: string; status: string };
    /** The entry's cycles (readings, playthroughs), newest first. */
    cycles: C[];
    /** The entry's tracked total, until the summary loads. */
    trackedMinutes: number;
    detailKey: QueryKey;
    /** No session can be added (a book without a page count). */
    disabled?: boolean;
    /** The domain fields of a new session, from `addFields`. */
    addExtras?: () => TimerExtras;
    /** Whether `addFields` holds a valid value. */
    addValid?: boolean;
    /** The domain fields of an edited session, from `editFields`. */
    editExtras?: () => Omit<Update, keyof UpdateSessionLike>;
    onBeginEdit?: (session: S) => void;
    /** The progress line on the page; renders an element with `titleId`. */
    progress: Snippet<
      [{ titleId: string; summary: Sum | null; cycle: C | null }]
    >;
    addFields?: Snippet<[{ busy: boolean }]>;
    editFields?: Snippet;
    /** Beside the week in "My sessions" (a game's total for this playthrough). */
    historyLead?: Snippet<[{ cycle: C | null }]>;
    /** The totals row of "My sessions". */
    historyStats: Snippet<[{ summary: Sum | null; cycle: C | null }]>;
    /** Under the buttons on the page (why none can be added). */
    notice?: Snippet;
  } = $props();

  const titleId = $props.id();
  const today = localDateInput();
  const reduced = prefersReducedMotion();
  // svelte-ignore state_referenced_locally
  let durationMinutes = $state(domain.defaultDuration);
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
  let linkToCycle = $state(true);
  let restartDropped = $state(false);

  const minDuration = $derived(domain.durationRequired ? 1 : 0);
  const sessionsQuery = createApiQuery(() => ({
    key: domain.keys.page(entry.id, page),
    fetch: () => domain.api.list(entry.id, page),
  }));
  const summary = $derived(sessionsQuery.data ?? null);
  const totalSessions = $derived(summary?.totalSessions ?? 0);
  const completedCycles = $derived(
    cycles.filter((cycle) => cycle.status === "COMPLETED"),
  );
  const lastFinishedCycle = $derived(
    cycles.find((cycle) => cycle.status !== "ACTIVE") ?? null,
  );
  const displayedCycle = $derived(
    (summary && domain.activeCycle(summary)) ??
      cycles.find((cycle) => cycle.status === "ACTIVE") ??
      lastFinishedCycle,
  );
  const historyGroups = $derived(
    groupSessionsByCycle(summary?.items ?? [], domain.cycleNumber, (number) =>
      number === null
        ? m.session_cycle_standalone()
        : domain.messages.cycle(number),
    ),
  );
  const restarts = $derived(
    entry.status === domain.doneStatus || restartDropped,
  );

  // Everything a session changes, besides the timer.
  const changed = (withProgression = true) => [
    domain.keys.root(entry.id),
    detailKey,
    domain.keys.stats(),
    keys.stats.social(),
    ...(withProgression ? [keys.gamification.progression()] : []),
    keys.feed.all(),
  ];

  const createMut = createApiMutation<Create, unknown>(() => ({
    mutate: (body) => domain.api.create(entry.id, body),
    invalidates: changed(),
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
    invalidates: [keys.sessionTimer.current(), ...changed()],
    onSuccess: () => {
      page = 1;
      notes = "";
      finishingTimer = false;
      showAdd = false;
    },
    successToast: m.session_timer_saved(),
    errorToast: true,
  }));

  const updateMut = createApiMutation<{ id: string; body: Update }, unknown>(
    () => ({
      mutate: ({ id, body }) => domain.api.update(id, body),
      invalidates: changed(false),
      onSuccess: () => (editingId = null),
      successToast: m.session_saved(),
      errorToast: true,
    }),
  );

  const restoreMut = createApiMutation<Create, unknown>(() => ({
    mutate: (body) => domain.api.create(entry.id, body),
    invalidates: changed(),
    onSuccess: () => (page = 1),
    successToast: m.session_restored(),
    errorToast: true,
  }));

  const deleteMut = createApiMutation<string, void>(() => ({
    mutate: (id) => domain.api.remove(id),
    invalidates: changed(),
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
                ...domain.restoreBody(deleted),
              } as Create),
          },
          "success",
        );
      }
    },
    errorToast: true,
  }));

  const busy = $derived(createMut.loading || finishTimerMut.loading);

  function weeklySummary(count: number, minutes: number): string {
    const duration = formatSessionMinutes(minutes);
    return count === 1
      ? m.session_week_summary_one({ duration })
      : m.session_week_summary_many({ count, duration });
  }

  function submit() {
    if (disabled || durationMinutes < minDuration || !addValid) return;
    const cycleAction: SessionCycleAction | undefined = !linkToCycle
      ? "HISTORY_ONLY"
      : restarts
        ? "RESTART"
        : entry.status === "DROPPED"
          ? "CONTINUE"
          : undefined;
    const extras = addExtras?.() ?? {};
    if (finishingTimer) {
      finishTimerMut.mutate({ notes: notes || null, cycleAction, ...extras });
      return;
    }
    createMut.mutate({
      durationMinutes,
      occurredAt: sessionDateToIso(occurredOn),
      notes: notes || null,
      cycleAction,
      ...extras,
    } as Create);
  }

  function openForm() {
    linkToCycle = true;
    restartDropped = false;
    showAdd = true;
  }

  function openAdd() {
    durationMinutes = domain.defaultDuration;
    finishingTimer = false;
    openForm();
  }

  function finishTimedSession(elapsedSeconds: number) {
    durationMinutes = timerMinutes(elapsedSeconds);
    notes = "";
    finishingTimer = true;
    openForm();
  }

  function closeAdd() {
    showAdd = false;
    finishingTimer = false;
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

  function beginEdit(session: S) {
    editingId = session.id;
    editDuration = session.durationMinutes;
    editDate = localDateInput(new Date(session.occurredAt));
    editNotes = session.notes ?? "";
    onBeginEdit?.(session);
  }

  function saveEdit(id: string) {
    if (editDuration < minDuration) return;
    updateMut.mutate({
      id,
      body: {
        durationMinutes: editDuration,
        occurredAt: sessionDateToIso(editDate),
        notes: editNotes || null,
        ...editExtras?.(),
      } as Update,
    });
  }
</script>

<!-- On the page: one progress line, the session button and the timer
     (FIC-07). The week, the totals and the history open in "My sessions". -->
<section aria-labelledby={titleId} class="flex flex-col gap-3">
  {@render progress({ titleId, summary, cycle: displayedCycle })}

  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      class="btn btn-primary grow whitespace-nowrap sm:grow-0"
      {disabled}
      onclick={openAdd}>
      <Icon name="plus" class="h-4 w-4" />
      {domain.messages.addShort()}
    </button>
    <SessionTimerControl
      domain={domain.timerDomain}
      entryId={entry.id}
      {disabled}
      compact
      onFinish={finishTimedSession} />
  </div>

  {#if totalSessions > 0}
    <button
      type="button"
      class="bg-surface hover:bg-surface-2 flex min-h-14 w-full items-center gap-3 rounded-xl px-4 text-left transition-colors"
      onclick={openHistory}>
      <span class="min-w-0 flex-1">
        <span class="font-semibold">{m.session_mine()}</span>
        <span class="text-dim ml-1.5 text-sm tabular-nums">
          {totalSessions} · {formatSessionMinutes(
            summary?.totalTrackedMinutes ?? trackedMinutes,
          )}
        </span>
      </span>
      <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
    </button>
  {:else if !sessionsQuery.loading && !disabled}
    <p class="text-dim text-xs">{m.session_first_hint()}</p>
  {/if}

  {@render notice?.()}
</section>

{#if showAdd}
  <Modal title={domain.messages.addTitle()} onclose={closeAdd}>
    <form
      class="flex flex-col gap-3"
      onsubmit={(event) => {
        event.preventDefault();
        submit();
      }}>
      {@render addFields?.({ busy })}

      {#if entry.status === "DROPPED" || entry.status === domain.doneStatus}
        <div
          class="border-border bg-bg/55 flex items-center justify-between gap-4 rounded-xl border p-3.5">
          <div class="min-w-0">
            <p class="text-sm font-semibold">
              {restarts
                ? domain.messages.restart()
                : domain.messages.continue()}
            </p>
            <p class="text-dim mt-0.5 text-xs leading-relaxed">
              {linkToCycle
                ? restarts
                  ? domain.messages.restartHelp()
                  : domain.messages.continueHelp()
                : domain.messages.historyOnlyHelp()}
            </p>
            {#if entry.status === "DROPPED" && linkToCycle}
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
            checked={linkToCycle}
            onChange={(checked) => (linkToCycle = checked)}
            label={entry.status === domain.doneStatus
              ? domain.messages.restart()
              : domain.messages.continue()} />
        </div>
      {/if}

      <SessionDurationPicker
        bind:value={durationMinutes}
        quickDurations={domain.quickDurations}
        optional={!domain.durationRequired}
        variant={domain.durationRequired ? "accent" : "neutral"}
        disabled={busy || finishingTimer} />

      <label
        class="flex flex-col gap-1.5 text-xs font-semibold {finishingTimer
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
            disabled={busy} />
        </span>
      </label>

      <label class="mt-1 flex flex-col gap-1.5 text-xs font-semibold">
        <span>
          {m.session_notes()}
          <span class="text-dim font-normal">{m.common_optional_marker()}</span>
        </span>
        <span class="relative">
          <textarea
            class="input min-h-28 w-full resize-y pb-7 leading-relaxed"
            maxlength={SESSION_NOTES_MAX_LENGTH}
            placeholder={domain.messages.notesPlaceholder()}
            bind:value={notes}
            disabled={busy}></textarea>
          <span
            class="text-dim text-micro pointer-events-none absolute right-3 bottom-2 tabular-nums">
            {notes.length} / {SESSION_NOTES_MAX_LENGTH}
          </span>
        </span>
      </label>

      <div class="mt-2 flex justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          disabled={busy}
          onclick={closeAdd}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={disabled ||
            busy ||
            !occurredOn ||
            durationMinutes < minDuration ||
            !addValid}>
          {m.session_save()}
        </button>
      </div>
    </form>
  </Modal>
{/if}

{#snippet week()}
  <div>
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h4 class="font-display font-bold">{m.common_this_week()}</h4>
      <p class="text-dim text-xs tabular-nums">
        {weeklySummary(summary?.weekSessions ?? 0, summary?.weekMinutes ?? 0)}
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
{/snippet}

{#if showHistory}
  <Modal
    title={m.session_mine()}
    description={domain.messages.historyDescription(totalSessions)}
    wide
    onclose={() => (showHistory = false)}>
    <div class="mb-5">
      {#if historyLead}
        <div
          class="grid gap-6 lg:grid-cols-[minmax(13rem,0.85fr)_minmax(20rem,1.15fr)] lg:items-end">
          <div>{@render historyLead({ cycle: displayedCycle })}</div>
          {@render week()}
        </div>
      {:else}
        {@render week()}
      {/if}

      {@render historyStats({ summary, cycle: displayedCycle })}

      <div class="mt-4 flex flex-wrap items-center gap-3">
        {#if completedCycles.length > 0}
          <div class="flex min-w-0 items-center gap-3">
            <span
              class="bg-success/12 text-success grid h-9 w-9 shrink-0 place-items-center rounded-full">
              <Icon name="check" class="h-4 w-4" />
            </span>
            <div class="min-w-0">
              <p class="text-sm font-semibold">
                {domain.messages.completed(completedCycles.length)}
              </p>
              <p class="text-dim truncate text-xs">
                {domain.messages.completedDetail(completedCycles[0]!)}
              </p>
            </div>
          </div>
        {:else if lastFinishedCycle?.status === "DROPPED"}
          <p class="text-dim text-xs">
            {domain.messages.cycle(lastFinishedCycle.number)} ·
            {m.session_cycle_dropped()}
          </p>
        {/if}
      </div>
    </div>
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
                                min={minDuration}
                                max={MAX_SESSION_DURATION_MINUTES}
                                optional={!domain.durationRequired}
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
                        {@render editFields?.()}
                        <label
                          class="mt-3 flex flex-col gap-1.5 text-xs font-semibold">
                          <span>
                            {m.session_notes()}
                            <span class="text-dim font-normal">
                              {m.common_optional_marker()}
                            </span>
                          </span>
                          <textarea
                            class="input min-h-24 w-full resize-y"
                            maxlength={SESSION_NOTES_MAX_LENGTH}
                            placeholder={domain.messages.notesPlaceholder()}
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
                            {domain.messages.historyItem(session)}
                          </p>
                          {#if session.notes}
                            <p
                              class="text-dim mt-1 text-sm leading-relaxed whitespace-pre-line">
                              « {session.notes} »
                            </p>
                          {/if}
                        </div>
                        <div class="flex items-start gap-2">
                          {#if session.durationMinutes > 0}
                            <span
                              class="font-display pt-0.5 text-sm font-bold tabular-nums">
                              {formatSessionMinutes(session.durationMinutes)}
                            </span>
                          {/if}
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
            onclick={() => changeHistoryPage(page - 1)}>
            ← {m.session_previous()}
          </button>
          <button
            type="button"
            class="btn-text text-xs"
            disabled={!summary.hasMore}
            onclick={() => changeHistoryPage(page + 1)}>
            {m.session_next()} →
          </button>
        </div>
      {/if}
    {:else if !sessionsQuery.loading}
      <EmptyState compact art={domain.emptyArt}>
        {m.session_history_empty()}
      </EmptyState>
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
