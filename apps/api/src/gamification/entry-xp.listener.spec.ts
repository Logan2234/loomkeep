import { XpReason } from "@loomkeep/shared/enums";
import { stubXp } from "../test-utils/stubs";
import {
  EntryAddedEvent,
  EntryCompletedEvent,
  EntryRemovedEvent,
} from "../work/entry.events";
import { EntryXpListener } from "./entry-xp.listener";

describe("EntryXpListener", () => {
  it("awards WORK_ADDED, and DOMAIN_STARTED on the domain's first entry", async () => {
    const xp = stubXp();
    const listener = new EntryXpListener(xp);

    await listener.onEntryAdded(new EntryAddedEvent("u1", "MUSIC", "e1", true));
    await listener.onEntryAdded(
      new EntryAddedEvent("u1", "MUSIC", "e2", false),
    );

    expect(xp.award).toHaveBeenCalledWith("u1", XpReason.WORK_ADDED, "e1");
    expect(xp.award).toHaveBeenCalledWith("u1", XpReason.WORK_ADDED, "e2");
    expect(xp.award).toHaveBeenCalledWith(
      "u1",
      XpReason.DOMAIN_STARTED,
      "MUSIC",
    );
    expect(xp.award).toHaveBeenCalledTimes(3);
  });

  it("awards a listened album, and nothing for a domain without a rule yet", async () => {
    const xp = stubXp();
    const listener = new EntryXpListener(xp);

    await listener.onEntryCompleted(
      new EntryCompletedEvent("u1", "MUSIC", "e1"),
    );
    await listener.onEntryCompleted(
      new EntryCompletedEvent("u1", "GAMES", "e2"),
    );

    expect(xp.award).toHaveBeenCalledExactlyOnceWith(
      "u1",
      XpReason.ALBUM_LISTENED,
      "e1",
    );
  });

  it("takes back the XP of the entry and of every row it took", async () => {
    const xp = stubXp();

    await new EntryXpListener(xp).onEntryRemoved(
      new EntryRemovedEvent("u1", "MUSIC", "e1", [
        { model: "MusicEntry", ids: ["e1"] },
        { model: "Review", ids: ["r1"] },
      ]),
    );

    expect(vi.mocked(xp.revokeBySource).mock.calls).toEqual([
      ["u1", "Entry", ["e1"]],
      ["u1", "MusicEntry", ["e1"]],
      ["u1", "Review", ["r1"]],
    ]);
  });
});
