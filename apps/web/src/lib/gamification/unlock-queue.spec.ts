import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENTER_MS,
  EXIT_MS,
  HOLD_MS,
  HOLD_RUSHED_MS,
  UnlockQueue,
  holdFor,
  type UnlockBubble,
} from "./unlock-queue";

/** One full slot: the bubble slides in, holds, slides back out. */
const SLOT = ENTER_MS + HOLD_MS + EXIT_MS;
const RUSHED_SLOT = ENTER_MS + HOLD_RUSHED_MS + EXIT_MS;

function achievement(id: string): UnlockBubble {
  return { kind: "achievement", id, key: `key_${id}`, xp: 50 };
}

describe("holdFor", () => {
  it("shortens the hold from the fourth consecutive bubble on", () => {
    expect([0, 1, 2].map(holdFor)).toEqual([HOLD_MS, HOLD_MS, HOLD_MS]);
    expect([3, 4, 9].map(holdFor)).toEqual([
      HOLD_RUSHED_MS,
      HOLD_RUSHED_MS,
      HOLD_RUSHED_MS,
    ]);
  });
});

describe("UnlockQueue", () => {
  let displayed: string[];
  let queue: UnlockQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    displayed = [];
    queue = new UnlockQueue({
      onDisplayed: (bubble) => displayed.push(bubble.id),
      reducedMotion: () => false,
    });
  });

  afterEach(() => {
    queue.destroy();
    vi.useRealTimers();
  });

  it("plays queued bubbles one at a time, in the order they were given", () => {
    queue.enqueue([achievement("a"), achievement("b"), achievement("c")]);

    expect(queue.current?.id).toBe("a");
    expect(queue.pendingCount).toBe(2);

    vi.advanceTimersByTime(SLOT);
    expect(queue.current?.id).toBe("b");

    vi.advanceTimersByTime(SLOT);
    expect(queue.current?.id).toBe("c");

    vi.advanceTimersByTime(SLOT);
    expect(queue.current).toBeNull();
    expect(displayed).toEqual(["a", "b", "c"]);
  });

  it("leaves the screen empty while one bubble slides out and the next in", () => {
    queue.enqueue([achievement("a"), achievement("b")]);

    vi.advanceTimersByTime(ENTER_MS + HOLD_MS);
    expect(queue.current).toBeNull();

    vi.advanceTimersByTime(EXIT_MS);
    expect(queue.current?.id).toBe("b");
  });

  it("shortens the hold from the fourth bubble of a run", () => {
    queue.enqueue([1, 2, 3, 4, 5].map((n) => achievement(`a${n}`)));

    vi.advanceTimersByTime(SLOT * 3);
    expect(queue.current?.id).toBe("a4");

    // It leaves on the rushed hold, well before the full one would end.
    vi.advanceTimersByTime(ENTER_MS + HOLD_RUSHED_MS - 1);
    expect(queue.current?.id).toBe("a4");
    vi.advanceTimersByTime(1);
    expect(queue.current).toBeNull();
    expect(ENTER_MS + HOLD_RUSHED_MS).toBeLessThan(ENTER_MS + HOLD_MS);

    vi.advanceTimersByTime(EXIT_MS);
    expect(queue.current?.id).toBe("a5");
  });

  it("counts the rushed run per run, not for the session", () => {
    queue.enqueue([1, 2, 3, 4].map((n) => achievement(`a${n}`)));
    vi.advanceTimersByTime(SLOT * 3 + RUSHED_SLOT);
    expect(queue.current).toBeNull();

    queue.enqueue([achievement("b1")]);
    expect(queue.current?.id).toBe("b1");
    vi.advanceTimersByTime(RUSHED_SLOT);
    expect(queue.current?.id).toBe("b1");
  });

  it("chains straight to the next bubble when one is dismissed", () => {
    queue.enqueue([achievement("a"), achievement("b")]);

    queue.dismiss();
    expect(queue.current).toBeNull();

    vi.advanceTimersByTime(EXIT_MS);
    expect(queue.current?.id).toBe("b");
    // Dismissing doesn't hide it from the server — it was seen.
    expect(displayed).toEqual(["a", "b"]);
  });

  it("empties the queue on a click through, marking everything displayed", () => {
    queue.enqueue([achievement("a"), achievement("b"), achievement("c")]);

    queue.stop();

    expect(queue.current).toBeNull();
    expect(queue.pendingCount).toBe(0);
    expect(displayed).toEqual(["a", "b", "c"]);

    vi.advanceTimersByTime(SLOT * 3);
    expect(queue.current).toBeNull();
  });

  it("ignores ids already queued, so a refetch never replays a bubble", () => {
    queue.enqueue([achievement("a"), achievement("b")]);
    queue.enqueue([achievement("a"), achievement("b"), achievement("c")]);

    expect(queue.pendingCount).toBe(2);

    vi.advanceTimersByTime(SLOT * 3);
    expect(displayed).toEqual(["a", "b", "c"]);
  });

  it("appends to a run already playing instead of restarting it", () => {
    queue.enqueue([achievement("a")]);
    vi.advanceTimersByTime(ENTER_MS);
    queue.enqueue([{ kind: "level", id: "level:7", level: 7 }]);

    expect(queue.current?.id).toBe("a");
    vi.advanceTimersByTime(SLOT);
    expect(queue.current?.id).toBe("level:7");
  });

  it("still plays and still marks bubbles under reduced motion", () => {
    const reducedQueue = new UnlockQueue({
      onDisplayed: (bubble) => displayed.push(bubble.id),
      reducedMotion: () => true,
    });

    reducedQueue.enqueue([achievement("a"), achievement("b")]);
    expect(reducedQueue.current?.id).toBe("a");

    // +1 because the exit is 0ms here: the follow-up timer is scheduled at
    // the very instant the hold ends, so it needs one more tick to run.
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(reducedQueue.current?.id).toBe("b");

    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(displayed).toEqual(["a", "b"]);
    reducedQueue.destroy();
  });

  it("notifies subscribers of every change, current value first", () => {
    const seen: (string | null)[] = [];
    const unsubscribe = queue.subscribe((current) =>
      seen.push(current?.id ?? null),
    );

    queue.enqueue([achievement("a")]);
    vi.advanceTimersByTime(SLOT);

    expect(seen).toEqual([null, "a", null, null]);
    unsubscribe();
  });
});
