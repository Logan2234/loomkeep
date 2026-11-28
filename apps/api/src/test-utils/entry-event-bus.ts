import { EventEmitter2 } from "@nestjs/event-emitter";
import { EntryXpListener } from "../gamification/entry-xp.listener";
import type { XpService } from "../gamification/xp.service";
import type { ActivityService } from "../social/activity.service";
import { EntryActivityListener } from "../social/entry-activity.listener";
import {
  EntryAddedEvent,
  EntryCompletedEvent,
  EntryRemovedEvent,
  EntryStatusChangedEvent,
} from "../work/entry.events";
import { stubXp } from "./stubs";

/**
 * An event bus wired to the real entry listeners over the test's XP and
 * activity doubles, as Nest wires them at runtime: a domain that publishes
 * entry events is tested on the XP and posts they end in.
 */
export function entryEventBus(
  deps: { xp?: XpService; activity?: ActivityService } = {},
): EventEmitter2 {
  const bus = new EventEmitter2();
  const xp = new EntryXpListener(deps.xp ?? stubXp());
  const activity = new EntryActivityListener(
    deps.activity ??
      ({ emit: () => Promise.resolve() } as unknown as ActivityService),
  );

  bus.on(EntryAddedEvent.NAME, (e: EntryAddedEvent) => xp.onEntryAdded(e));
  bus.on(EntryCompletedEvent.NAME, (e: EntryCompletedEvent) =>
    xp.onEntryCompleted(e),
  );
  bus.on(EntryRemovedEvent.NAME, (e: EntryRemovedEvent) =>
    xp.onEntryRemoved(e),
  );
  bus.on(EntryStatusChangedEvent.NAME, (e: EntryStatusChangedEvent) =>
    activity.onEntryStatusChanged(e),
  );
  return bus;
}
