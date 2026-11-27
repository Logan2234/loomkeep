import { describe, expect, it } from "vitest";
import {
  DragVelocity,
  isDismissed,
  settleDuration,
  sheetStop,
} from "./swipe-dismiss";

describe("isDismissed", () => {
  const base = { size: 400, fraction: 0.3 };

  it("dismisses past the distance threshold, even released slowly", () => {
    expect(isDismissed({ ...base, distance: 130, velocity: 0 })).toBe(true);
  });

  it("dismisses a short flick", () => {
    expect(isDismissed({ ...base, distance: 40, velocity: 0.8 })).toBe(true);
  });

  it("snaps back from a short, slow drag", () => {
    expect(isDismissed({ ...base, distance: 40, velocity: 0.1 })).toBe(false);
  });

  it("never dismisses a drag that ended back past its start", () => {
    expect(isDismissed({ ...base, distance: -10, velocity: 2 })).toBe(false);
  });
});

describe("DragVelocity", () => {
  it("measures the speed of the gesture's end", () => {
    const velocity = new DragVelocity();
    velocity.add(0, 0);
    velocity.add(10, 200);
    velocity.add(40, 250);
    velocity.add(90, 300);
    // The slow start (10px in 200ms) is outside the last 100ms.
    expect(velocity.at(300)).toBe(0.8);
  });

  it("reads zero once the finger has stopped before lifting", () => {
    const velocity = new DragVelocity();
    velocity.add(0, 0);
    velocity.add(80, 50);
    expect(velocity.at(400)).toBe(0);
  });

  it("starts over after a reset", () => {
    const velocity = new DragVelocity();
    velocity.add(0, 0);
    velocity.add(80, 50);
    velocity.reset();
    velocity.add(80, 60);
    expect(velocity.at(60)).toBe(0);
  });
});

describe("settleDuration", () => {
  it("matches the finger's speed", () => {
    expect(settleDuration(200, 1)).toBe(200);
  });

  it("stays within bounds", () => {
    expect(settleDuration(10, 3)).toBe(150);
    expect(settleDuration(600, 0.5)).toBe(300);
  });

  it("takes its time when released without momentum", () => {
    expect(settleDuration(40, 0)).toBe(300);
  });
});

describe("sheetStop", () => {
  const base = { halfAt: 300, size: 700, fraction: 0.3 };

  it("moves one stop on a flick", () => {
    const flick = { ...base, position: 300 };
    expect(sheetStop({ ...flick, velocity: -1, from: "half" })).toBe("full");
    expect(sheetStop({ ...flick, velocity: 1, from: "half" })).toBe("closed");
    expect(sheetStop({ ...flick, velocity: 1, from: "full" })).toBe("half");
  });

  it("settles on the nearest stop when released slowly", () => {
    const slow = { ...base, velocity: 0, from: "half" as const };
    expect(sheetStop({ ...slow, position: 100 })).toBe("full");
    expect(sheetStop({ ...slow, position: 320 })).toBe("half");
    expect(sheetStop({ ...slow, position: 500 })).toBe("closed");
  });
});
