import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { emitEntryActivity } from "../work/entry-lifecycle.util";
import { EntryStatusChangedEvent } from "../work/entry.events";
import { ActivityService } from "./activity.service";

/** The activity posts of library writes, for the domains that publish entry events. */
@Injectable()
export class EntryActivityListener {
  constructor(private readonly activity: ActivityService) {}

  /** A status milestone, and FAVORITED when a work is newly favourited. */
  @OnEvent(EntryStatusChangedEvent.NAME)
  async onEntryStatusChanged(event: EntryStatusChangedEvent): Promise<void> {
    await emitEntryActivity(this.activity, event.target, event.change);
  }
}
