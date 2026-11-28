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

  // emitAsync awaits what a listener returns, as Nest's @OnEvent does; the
  // emitter's own type only declares void-returning listeners.
  const on = <E>(name: string, handle: (event: E) => Promise<void>) =>
    bus.on(name, handle as (event: E) => void);

  on(EntryAddedEvent.NAME, (e: EntryAddedEvent) => xp.onEntryAdded(e));
  on(EntryCompletedEvent.NAME, (e: EntryCompletedEvent) =>
    xp.onEntryCompleted(e),
  );
  on(EntryRemovedEvent.NAME, (e: EntryRemovedEvent) => xp.onEntryRemoved(e));
  on(EntryStatusChangedEvent.NAME, (e: EntryStatusChangedEvent) =>
    activity.onEntryStatusChanged(e),
  );
  return bus;
}
