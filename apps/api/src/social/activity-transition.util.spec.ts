import { ActivityType } from "@loomkeep/shared";
import { classifyStatusTransition } from "./activity-transition.util";

describe("classifyStatusTransition", () => {
  it("new planned entry is ADDED, off the home feed", () => {
    expect(classifyStatusTransition("MEDIA", null, "PLANNED")).toEqual({
      type: ActivityType.ADDED,
      homeFeed: false,
    });
    expect(classifyStatusTransition("GAMES", null, "BACKLOG")).toEqual({
      type: ActivityType.ADDED,
      homeFeed: false,
    });
  });

  it("new entry added straight as started/completed is STARTED/FINISHED", () => {
    expect(classifyStatusTransition("MEDIA", null, "WATCHING")).toEqual({
      type: ActivityType.STARTED,
      homeFeed: true,
    });
    expect(classifyStatusTransition("BOOKS", null, "READ")).toEqual({
      type: ActivityType.FINISHED,
      homeFeed: true,
    });
  });

  it("emits milestones only when the role changes", () => {
    expect(classifyStatusTransition("MEDIA", "PLANNED", "WATCHING")).toEqual({
      type: ActivityType.STARTED,
      homeFeed: true,
    });
    expect(classifyStatusTransition("MEDIA", "WATCHING", "COMPLETED")).toEqual({
      type: ActivityType.FINISHED,
      homeFeed: true,
    });
    expect(classifyStatusTransition("GAMES", "PLAYING", "DROPPED")).toEqual({
      type: ActivityType.DROPPED,
      homeFeed: false,
    });
  });

  it("WATCHING → UP_TO_DATE is a no-op (both 'completed' role)", () => {
    expect(classifyStatusTransition("MEDIA", "COMPLETED", "UP_TO_DATE")).toBe(
      null,
    );
  });

  it("no change in role is silent", () => {
    expect(classifyStatusTransition("MEDIA", "WATCHING", "WATCHING")).toBe(
      null,
    );
  });

  it("returns null for an unknown domain or status", () => {
    expect(classifyStatusTransition("MUSIC" as never, "X", "Y")).toBe(null);
    expect(classifyStatusTransition("MEDIA", null, "NONSENSE")).toBe(null);
  });
});
