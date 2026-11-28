import { type Domain, XpReason } from "@loomkeep/shared/enums";
import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  EntryAddedEvent,
  EntryCompletedEvent,
  EntryRemovedEvent,
} from "../work/entry.events";
import { XpService } from "./xp.service";

/**
 * The XP a domain's finished status earns. Domains join as they move to the
 * entry events (API-08); one missing here earns nothing on completion.
 */
const COMPLETION_XP: Partial<Record<Domain, XpReason>> = {
  MUSIC: XpReason.ALBUM_LISTENED,
};

/** The XP rules of library writes, for the domains that publish entry events. */
@Injectable()
export class EntryXpListener {
  constructor(private readonly xp: XpService) {}

  /** WORK_ADDED, and the one-off DOMAIN_STARTED on a domain's first entry. */
  @OnEvent(EntryAddedEvent.NAME)
  async onEntryAdded(event: EntryAddedEvent): Promise<void> {
    await this.xp.award(event.userId, XpReason.WORK_ADDED, event.entryId);

    if (event.firstInDomain) {
      await this.xp.award(event.userId, XpReason.DOMAIN_STARTED, event.domain);
    }
  }

  @OnEvent(EntryCompletedEvent.NAME)
  async onEntryCompleted(event: EntryCompletedEvent): Promise<void> {
    const reason = COMPLETION_XP[event.domain];
    if (reason) await this.xp.award(event.userId, reason, event.entryId);
  }

  /**
   * Takes back the XP of everything the removal took: the entry (its
   * WORK_ADDED is sourced `Entry`), its rows and the user's review.
   */
  @OnEvent(EntryRemovedEvent.NAME)
  async onEntryRemoved(event: EntryRemovedEvent): Promise<void> {
    await this.xp.revokeBySource(event.userId, "Entry", [event.entryId]);

    for (const { model, ids } of event.removed) {
      await this.xp.revokeBySource(event.userId, model, ids);
    }
  }
}
