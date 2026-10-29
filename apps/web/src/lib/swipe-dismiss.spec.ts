import { describe, expect, it } from "vitest";
import { DragVelocity, isDismissed } from "./swipe-dismiss";

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
