import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PEEK_CLOSE_GRACE_MS,
  PEEK_OPEN_DELAY_MS,
  PeekTimer,
} from "./peek-timer";

function setup() {
  const changes: [string | null, boolean][] = [];
  const timer = new PeekTimer<string>((target, open) =>
    changes.push([target, open]),
  );
  const last = () => changes.at(-1);
  return { timer, changes, last };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("PeekTimer", () => {
  it("announces the target at once and opens it after the delay", () => {
    const { timer, last } = setup();

    timer.enter("villeneuve");
    expect(last()).toEqual(["villeneuve", false]);

    vi.advanceTimersByTime(PEEK_OPEN_DELAY_MS - 1);
    expect(last()).toEqual(["villeneuve", false]);
    vi.advanceTimersByTime(1);
    expect(last()).toEqual(["villeneuve", true]);
  });

  it("opens nothing when the pointer only passes over", () => {
    const { timer, changes } = setup();

    timer.enter("chalamet");
    vi.advanceTimersByTime(PEEK_OPEN_DELAY_MS / 2);
    timer.leave();
    vi.advanceTimersByTime(PEEK_OPEN_DELAY_MS);

    expect(changes).toEqual([
      ["chalamet", false],
      [null, false],
    ]);
  });

  it("stays open while the pointer crosses to the peek, and closes after the grace", () => {
    const { timer, last } = setup();
    timer.enter("zendaya");
    vi.advanceTimersByTime(PEEK_OPEN_DELAY_MS);

    timer.leave();
    vi.advanceTimersByTime(PEEK_CLOSE_GRACE_MS - 1);
    timer.hold();
    vi.advanceTimersByTime(PEEK_CLOSE_GRACE_MS);
    expect(last()).toEqual(["zendaya", true]);

    timer.leave();
    vi.advanceTimersByTime(PEEK_CLOSE_GRACE_MS);
    expect(last()).toEqual([null, false]);
  });

  it("switches straight to the next name once a peek is open", () => {
    const { timer, last } = setup();
    timer.enter("zendaya");
    vi.advanceTimersByTime(PEEK_OPEN_DELAY_MS);

    timer.leave();
    timer.enter("ferguson");

    expect(last()).toEqual(["ferguson", true]);
  });

  it("closes at once on request", () => {
    const { timer, last } = setup();
    timer.enter("bardem");
    vi.advanceTimersByTime(PEEK_OPEN_DELAY_MS);

    timer.close();
    vi.advanceTimersByTime(PEEK_OPEN_DELAY_MS);

    expect(last()).toEqual([null, false]);
  });
});
