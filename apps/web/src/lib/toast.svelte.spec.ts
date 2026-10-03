import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastStore } from "./toast.svelte";

describe("ToastStore actions", () => {
  afterEach(() => vi.useRealTimers());

  it("runs an action once and removes its toast", () => {
    const store = new ToastStore();
    const action = vi.fn();
    const id = store.action("Session deleted", {
      label: "Undo",
      onSelect: action,
    });

    store.selectAction(id);

    expect(action).toHaveBeenCalledOnce();
    expect(store.items).toEqual([]);
  });

  it("keeps actionable toasts visible for their configured duration", () => {
    vi.useFakeTimers();
    const store = new ToastStore();
    store.action("Session deleted", { label: "Undo", onSelect: vi.fn() });

    vi.advanceTimersByTime(7999);
    expect(store.items).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(store.items).toHaveLength(0);
  });

  it("holds the countdown while paused and resumes with the time left", () => {
    vi.useFakeTimers();
    const store = new ToastStore();
    const id = store.action("Next up", { label: "Add", onSelect: vi.fn() });

    vi.advanceTimersByTime(5000);
    store.pause(id);
    vi.advanceTimersByTime(60_000);
    expect(store.items).toHaveLength(1);

    store.resume(id);
    vi.advanceTimersByTime(2999);
    expect(store.items).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(store.items).toHaveLength(0);
  });

  it("runs the action picked among several", () => {
    const store = new ToastStore();
    const add = vi.fn();
    const open = vi.fn();
    const id = store.action("Next up", [
      { label: "Add", onSelect: add },
      { label: "Open", onSelect: open },
    ]);

    store.selectAction(id, 1);

    expect(open).toHaveBeenCalledOnce();
    expect(add).not.toHaveBeenCalled();
    expect(store.items).toEqual([]);
  });
});
