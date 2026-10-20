import { describe, expect, it, vi } from "vitest";
import { showAppBadge } from "./app-badge";

describe("showAppBadge", () => {
  it("shows a count on the icon, and clears it at zero", () => {
    const nav = {
      setAppBadge: vi.fn().mockResolvedValue(undefined),
      clearAppBadge: vi.fn().mockResolvedValue(undefined),
    } as unknown as Navigator;

    showAppBadge(4, nav);
    showAppBadge(0, nav);

    expect(nav.setAppBadge).toHaveBeenCalledWith(4);
    expect(nav.clearAppBadge).toHaveBeenCalledOnce();
  });

  it("does nothing where the browser has no badge, or refuses it", async () => {
    expect(() => showAppBadge(2, {} as Navigator)).not.toThrow();

    const refused = {
      setAppBadge: vi.fn().mockRejectedValue(new Error("NotAllowedError")),
    } as unknown as Navigator;
    showAppBadge(2, refused);
    await Promise.resolve();
  });
});
