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
});
