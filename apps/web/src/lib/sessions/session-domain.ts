import type {
  FinishSessionTimerDto,
  SessionWeekDayDto,
} from "@loomkeep/shared/contracts";
import type {
  SessionCycleAction,
  TrackingCycleStatus,
} from "@loomkeep/shared/enums";
import type { QueryKey } from "@tanstack/svelte-query";

/** What `SessionDock` reads of a reading or play session. */
export interface SessionLike {
  id: string;
  durationMinutes: number;
  notes: string | null;
  occurredAt: string;
}

/** What `SessionDock` reads of a reading or a playthrough. */
export interface CycleLike {
  number: number;
  status: TrackingCycleStatus;
  trackedMinutes: number;
}

/** What `SessionDock` reads of `GET /books|games/entries/:id/sessions`. */
export interface SessionSummaryLike<S extends SessionLike> {
  items: S[];
  hasMore: boolean;
  totalSessions: number;
  totalTrackedMinutes: number;
  weekMinutes: number;
  weekSessions: number;
  weekDays: SessionWeekDayDto[];
}

/** The fields every domain's create body shares. */
export interface CreateSessionLike {
  durationMinutes: number;
  occurredAt: string;
  notes?: string | null;
  cycleAction?: SessionCycleAction;
}

/** The fields every domain's update body shares. */
export interface UpdateSessionLike {
  durationMinutes?: number;
  occurredAt?: string;
  notes?: string | null;
}

/**
 * What a domain with sessions (books, games) tells `SessionDock`: its
 * endpoints and query keys, how its cycles are named, and its wording. The
 * fields only one domain has (pages read, Steam playtime) stay in that
 * domain's dock, which passes them to `SessionDock` as snippets.
 */
export interface SessionDomain<
  S extends SessionLike,
  C extends CycleLike,
  Sum extends SessionSummaryLike<S>,
  Create extends CreateSessionLike,
  Update extends UpdateSessionLike,
> {
  /** The session timer's domain. */
  timerDomain: "BOOKS" | "GAMES";
  /** Status of an entry whose last cycle is finished: a new session restarts it. */
  doneStatus: string;
  quickDurations: readonly number[];
  /** Duration the add form opens with. */
  defaultDuration: number;
  /** A play session needs a duration; reading time can be left out. */
  durationRequired: boolean;
  emptyArt: "book" | "controller";

  keys: {
    root: (entryId: string) => QueryKey;
    page: (entryId: string, page: number) => QueryKey;
    /** The domain's stats, which a session changes. */
    stats: () => QueryKey;
  };
  api: {
    list: (entryId: string, page: number) => Promise<Sum>;
    create: (entryId: string, body: Create) => Promise<unknown>;
    update: (id: string, body: Update) => Promise<unknown>;
    remove: (id: string) => Promise<void>;
  };

  /** The cycle a session belongs to; null for a session kept as history only. */
  cycleNumber: (session: S) => number | null;
  activeCycle: (summary: Sum) => C | null;
  /** What re-creating a deleted session needs beyond duration, date and notes. */
  restoreBody: (session: S) => Omit<Create, keyof CreateSessionLike>;

  messages: {
    addShort: () => string;
    addTitle: () => string;
    notesPlaceholder: () => string;
    historyDescription: (count: number) => string;
    historyItem: (session: S) => string;
    cycle: (number: number) => string;
    completed: (count: number) => string;
    completedDetail: (cycle: C) => string;
    restart: () => string;
    restartHelp: () => string;
    continue: () => string;
    continueHelp: () => string;
    historyOnlyHelp: () => string;
  };
}

/** The domain fields a finished timer's session carries (a book's pages). */
export type TimerExtras = Omit<FinishSessionTimerDto, "notes" | "cycleAction">;
