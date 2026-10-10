import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyFeedback } from "./clipboard.svelte";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("copy feedback lifecycle", () => {
  it("keeps the latest link copied until its own timeout expires", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const feedback = new CopyFeedback<string>();
    await feedback.copy("first", "first");
    vi.advanceTimersByTime(1000);
    await feedback.copy("second", "second");
    vi.advanceTimersByTime(1000);
    expect(feedback.value).toBe("second");
    vi.advanceTimersByTime(1000);
    expect(feedback.value).toBeNull();
  });

  it("ignores a clipboard result that arrives after cleanup", async () => {
    let complete!: () => void;
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: () =>
          new Promise<void>((resolve) => {
            complete = resolve;
          }),
      },
    });
    const feedback = new CopyFeedback();
    const pending = feedback.copy("secret", true);
    feedback.reset();
    complete();
    expect(await pending).toBe(false);
    expect(feedback.value).toBeNull();
  });
});
