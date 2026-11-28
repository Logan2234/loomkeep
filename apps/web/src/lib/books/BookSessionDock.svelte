<script lang="ts">
  // A book's session dock: SessionDock, plus the pages read (a count or a
  // range), the progress through the edition and the reading pace.
  import {
    type BookEntryDto,
    type BookReadingDto,
    type BookSessionDto,
    type BookSessionSummaryDto,
    type CreateBookSessionDto,
    type UpdateBookSessionDto,
  } from "@loomkeep/shared/contracts";
  import type { QueryKey } from "@tanstack/svelte-query";

  import {
    createBookSession,
    deleteBookSession,
    getBookSessions,
    updateBookSession,
  } from "#lib/api/books.js";
  import { keys } from "#lib/api/keys.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { SessionDomain } from "#lib/sessions/session-domain.js";
  import { formatSessionMinutes } from "#lib/sessions/session-presentation.js";
  import SessionDock from "#lib/sessions/SessionDock.svelte";
  import AnimatedNumberInput from "#lib/ui/AnimatedNumberInput.svelte";
  import Banner from "#lib/ui/Banner.svelte";
  import { formatDate } from "#lib/ui/format.js";
  import PageNumberControl from "#lib/ui/PageNumberControl.svelte";
  import ProgressBar from "#lib/ui/ProgressBar.svelte";
  import SegmentedControl from "#lib/ui/SegmentedControl.svelte";

  let {
    entry,
    detailKey,
  }: {
    entry: BookEntryDto;
    detailKey: QueryKey;
  } = $props();

  type PageMode = "quantity" | "range";

  const domain: SessionDomain<
    BookSessionDto,
    BookReadingDto,
    BookSessionSummaryDto,
    CreateBookSessionDto,
    UpdateBookSessionDto
  > = {
    timerDomain: "BOOKS",
    doneStatus: "READ",
    quickDurations: [15, 30, 45, 60],
    defaultDuration: 0,
    durationRequired: false,
    emptyArt: "book",
    keys: {
      root: keys.books.sessionsRoot,
      page: keys.books.sessions,
      stats: keys.stats.books,
    },
    api: {
      list: getBookSessions,
      create: createBookSession,
      update: updateBookSession,
      remove: deleteBookSession,
    },
    cycleNumber: (session) => session.readingNumber,
    activeCycle: (summary) => summary.activeReading,
    restoreBody: (session) =>
      session.startPage === null
        ? { pagesRead: session.pagesRead }
        : { startPage: session.startPage, endPage: session.endPage! },
    messages: {
      addShort: m.book_session_add_short,
      addTitle: m.book_session_add_title,
      notesPlaceholder: m.book_session_notes_placeholder,
      historyDescription: (count) =>
        count === 1
          ? m.book_session_history_grouped_one()
          : m.book_session_history_grouped_many({ count }),
      historyItem: (session) =>
        session.readingNumber === null
          ? m.book_session_history_standalone({ count: session.pagesRead })
          : session.startPage === null
            ? m.book_session_history_quantity({ count: session.pagesRead })
            : m.book_session_history_range({
                start: session.startPage,
                end: session.endPage!,
              }),
      cycle: (number) => m.book_cycle_current({ number }),
      completed: (count) =>
        count === 1
          ? m.book_cycle_completed_one()
          : m.book_cycle_completed_many({ count }),
      completedDetail: (reading) =>
        m.book_cycle_completed_detail({
          number: reading.number,
          count: reading.referencePageCount ?? reading.currentPage,
        }),
      restart: m.session_cycle_restart_book,
      restartHelp: m.session_cycle_restart_book_help,
      continue: m.session_cycle_continue_book,
      continueHelp: m.session_cycle_continue_book_help,
      historyOnlyHelp: m.session_cycle_history_only_book_help,
    },
  };

  const pageModeOptions = $derived([
    { value: "quantity" as const, label: m.book_session_mode_quantity() },
    { value: "range" as const, label: m.book_session_mode_range() },
  ]);

  let mode = $state<PageMode>("quantity");
  let pagesRead = $state(10);
  let startPage = $state(0);
  let endPage = $state(10);
  let editMode = $state<PageMode>("quantity");
  let editPagesRead = $state(0);
  let editStartPage = $state(0);
  let editEndPage = $state(1);
  let initializedEntryId = $state<string | null>(null);

  $effect(() => {
    if (initializedEntryId === entry.id) return;
    initializedEntryId = entry.id;
    startPage = Math.max(0, entry.currentPage);
    endPage = Math.max(1, entry.currentPage + 10);
  });

  const referencePages = $derived(entry.referencePageCount);
  const pagesValid = $derived(
    mode === "quantity"
      ? pagesRead >= 1
      : startPage >= 0 && endPage > startPage,
  );

  function beginEdit(session: BookSessionDto) {
    editMode = session.startPage === null ? "quantity" : "range";
    editPagesRead = session.pagesRead;
    editStartPage = session.startPage ?? 1;
    editEndPage = session.endPage ?? Math.max(1, session.pagesRead);
  }

  function editPages() {
    return editMode === "quantity"
      ? { pagesRead: editPagesRead, startPage: null, endPage: null }
      : {
          pagesRead: editEndPage - editStartPage,
          startPage: editStartPage,
          endPage: editEndPage,
        };
  }
</script>

<SessionDock
  {domain}
  {entry}
  cycles={entry.readings}
  trackedMinutes={entry.trackedReadingMinutes}
  {detailKey}
  disabled={!referencePages}
  addExtras={() =>
    mode === "quantity" ? { pagesRead } : { startPage, endPage }}
  addValid={pagesValid}
  editExtras={editPages}
  onBeginEdit={beginEdit}>
  {#snippet progress({ titleId, summary, cycle })}
    {@const reference = cycle?.referencePageCount ?? referencePages}
    {@const current = cycle?.currentPage ?? entry.currentPage}
    {@const percent = reference
      ? Math.min(100, Math.round((current / reference) * 100))
      : 0}
    {@const remaining = reference ? Math.max(0, reference - current) : null}
    {#if reference && ((summary?.totalSessions ?? 0) > 0 || current > 0)}
      <div class="flex flex-col gap-1.5">
        <p class="flex flex-wrap items-baseline gap-x-2">
          <span
            id={titleId}
            class="font-display text-lg font-extrabold tabular-nums">
            {m.book_session_page_value({ number: current })}
          </span>
          <span class="text-dim text-sm tabular-nums">
            {m.book_cycle_page_context({ count: reference, progress: percent })}
          </span>
        </p>
        <ProgressBar
          value={percent}
          label={m.book_session_progress()}
          height="h-2.5"
          fillClass="bg-accent"
          endCap="bookmark" />
        <p class="text-dim text-xs tabular-nums">
          {#if remaining !== null}{m.book_cycle_remaining({
              count: remaining,
            })}{/if}{#if remaining !== null && summary?.estimatedCompletionDate}
            ·
          {/if}{#if summary?.estimatedCompletionDate}{m.book_session_eta({
              date: formatDate(`${summary.estimatedCompletionDate}T12:00:00`),
            })}{/if}
        </p>
      </div>
    {:else}
      <h3 id={titleId} class="sr-only">{m.book_session_add_short()}</h3>
    {/if}
  {/snippet}

  {#snippet notice()}
    {#if !referencePages}
      <Banner variant="info">{m.book_session_reference_missing()}</Banner>
    {/if}
  {/snippet}

  {#snippet addFields({ busy })}
    <SegmentedControl
      options={pageModeOptions}
      value={mode}
      onChange={(next) => (mode = next)}
      label={m.book_session_pages()}
      class="w-full [&>button]:flex-1 [&>button]:justify-center" />
    <div
      class="border-accent/35 from-accent/14 to-accent/3 rounded-2xl border bg-linear-to-br p-4 sm:p-5">
      {#if mode === "quantity"}
        <PageNumberControl
          bind:value={pagesRead}
          label={m.book_session_pages()}
          min={1}
          max={referencePages ?? undefined}
          disabled={busy} />
      {:else}
        <div
          class="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
          <PageNumberControl
            bind:value={startPage}
            label={m.book_session_start_page()}
            min={0}
            max={referencePages ?? undefined}
            disabled={busy}
            compact />
          <span
            class="text-dim rotate-90 justify-self-center text-xl sm:mb-4 sm:rotate-0"
            aria-hidden="true">
            →
          </span>
          <PageNumberControl
            bind:value={endPage}
            label={m.book_session_end_page()}
            min={1}
            max={referencePages ?? undefined}
            disabled={busy}
            compact />
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet editFields()}
    <SegmentedControl
      options={pageModeOptions}
      value={editMode}
      onChange={(next) => (editMode = next)}
      label={m.book_session_pages()}
      class="mt-3 w-full [&>button]:flex-1 [&>button]:justify-center" />
    {#if editMode === "quantity"}
      <label class="mt-3 flex flex-col gap-1.5 text-xs font-semibold">
        <span>{m.book_session_pages()}</span>
        <AnimatedNumberInput
          bind:value={editPagesRead}
          label={m.book_session_pages()}
          min={1}
          max={referencePages ?? undefined}
          class="border-border bg-bg h-11 w-full"
          numberClass="text-base" />
      </label>
    {:else}
      <div class="mt-3 grid grid-cols-2 gap-3">
        <label class="flex min-w-0 flex-col gap-1.5 text-xs font-semibold">
          <span>{m.book_session_start_page()}</span>
          <AnimatedNumberInput
            bind:value={editStartPage}
            label={m.book_session_start_page()}
            min={0}
            max={referencePages ?? undefined}
            class="border-border bg-bg h-11 w-full min-w-0"
            numberClass="text-base" />
        </label>
        <label class="flex min-w-0 flex-col gap-1.5 text-xs font-semibold">
          <span>{m.book_session_end_page()}</span>
          <AnimatedNumberInput
            bind:value={editEndPage}
            label={m.book_session_end_page()}
            min={1}
            max={referencePages ?? undefined}
            class="border-border bg-bg h-11 w-full min-w-0"
            numberClass="text-base" />
        </label>
      </div>
    {/if}
  {/snippet}

  {#snippet historyStats({ summary, cycle })}
    <dl class="border-border mt-5 grid grid-cols-1 border-y sm:grid-cols-3">
      <div class="border-border px-1 py-3 sm:border-r sm:px-4">
        <dt class="text-dim text-xs">{m.book_cycle_time()}</dt>
        <dd class="font-display mt-1 text-lg font-bold tabular-nums">
          {formatSessionMinutes(cycle?.trackedMinutes ?? 0)}
        </dd>
      </div>
      <div
        class="border-border border-t px-1 py-3 sm:border-t-0 sm:border-r sm:px-4">
        <dt class="text-dim text-xs">{m.book_session_total_time()}</dt>
        <dd class="font-display mt-1 text-lg font-bold tabular-nums">
          {formatSessionMinutes(
            summary?.totalTrackedMinutes ?? entry.trackedReadingMinutes,
          )}
        </dd>
      </div>
      <div class="border-border border-t px-1 py-3 sm:border-t-0 sm:px-4">
        <dt class="text-dim text-xs">{m.book_session_pace()}</dt>
        <dd class="font-display mt-1 text-lg font-bold">
          {summary?.averagePagesPerDay === null ||
          summary?.averagePagesPerDay === undefined
            ? m.book_session_pace_pending()
            : m.book_session_pace_value({ count: summary.averagePagesPerDay })}
        </dd>
      </div>
    </dl>
  {/snippet}
</SessionDock>
