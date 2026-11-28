// What a domain's library tells the modules that react to it: gamification
// (XP, achievements) and social (the activity feed). A domain publishes these
// with EventEmitter2.emitAsync() instead of calling them, so the rules (which
// XP a completed album earns) live with the module that applies them
// (docs/adr/0010-module-layers.md). emitAsync awaits every listener: they run
// before the request answers, and their error reaches the caller.
//
// The four domains share these events. They move to them one at a time
// (architecture audit, API-08): music publishes them; media, games and books
// still call XpService and ActivityService directly.
import type { Domain } from "@loomkeep/shared/enums";
import type {
  EntryActivityTarget,
  EntryStatusChange,
} from "./entry-lifecycle.util";

/** A work entered the user's library: a true first insert, never an update. */
export class EntryAddedEvent {
  static readonly NAME = "entry.added";

  constructor(
    readonly userId: string,
    readonly domain: Domain,
    readonly entryId: string,
    /** It is the user's first entry in this domain. */
    readonly firstInDomain: boolean,
  ) {}
}

/**
 * An entry was written, its status or favourite possibly changed. Published
 * on every write; the listener decides whether the change is worth a post.
 */
export class EntryStatusChangedEvent {
  static readonly NAME = "entry.status-changed";

  constructor(
    readonly target: EntryActivityTarget,
    readonly change: EntryStatusChange,
  ) {}
}

/** An entry reached its domain's finished status (an album listened to). */
export class EntryCompletedEvent {
  static readonly NAME = "entry.completed";

  constructor(
    readonly userId: string,
    readonly domain: Domain,
    readonly entryId: string,
  ) {}
}

/** An entry was deleted, with the rows that went with it. */
export class EntryRemovedEvent {
  static readonly NAME = "entry.removed";

  constructor(
    readonly userId: string,
    readonly domain: Domain,
    readonly entryId: string,
    /**
     * Every row the removal took, by Prisma model: the entry itself
     * (`MusicEntry`), its cycles, the user's review of the work (`Review`).
     */
    readonly removed: { model: string; ids: string[] }[],
  ) {}
}
