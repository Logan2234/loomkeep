import { afterEach, describe, expect, it, vi } from "vitest";
import { Cooldown } from "./cooldown.svelte";

afterEach(() => vi.useRealTimers());

describe("countdown lifecycle", () => {
  it("restarts without retaining the previous interval and stops on cleanup", () => {
    vi.useFakeTimers();
    const cooldown = new Cooldown();
    cooldown.start(5);
    vi.advanceTimersByTime(2000);
    expect(cooldown.remaining).toBe(3);
    cooldown.start(60);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(cooldown.remaining).toBe(59);
    cooldown.stop();
    expect(cooldown.remaining).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses elapsed time when an interval fires late", () => {
    vi.useFakeTimers();
    const cooldown = new Cooldown();
    cooldown.start(5);
    vi.setSystemTime(Date.now() + 10000);
    vi.advanceTimersByTime(1000);
    expect(cooldown.remaining).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
