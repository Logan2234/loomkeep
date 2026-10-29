import { afterEach, describe, expect, it, vi } from "vitest";
import { successFeedback, tapFeedback } from "./haptics";

const { isPluginAvailable, impact, notification } = vi.hoisted(() => ({
  isPluginAvailable: vi.fn(),
  impact: vi.fn(),
  notification: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isPluginAvailable } }));
vi.mock("@capacitor/haptics", () => ({
  Haptics: { impact, notification },
  ImpactStyle: { Light: "LIGHT" },
  NotificationType: { Success: "SUCCESS" },
}));

afterEach(() => vi.resetAllMocks());

describe("haptic feedback", () => {
  it("taps lightly and plays the success pattern where it can", () => {
    isPluginAvailable.mockReturnValue(true);
    impact.mockResolvedValue(undefined);
    notification.mockResolvedValue(undefined);

    tapFeedback();
    successFeedback();

    expect(impact).toHaveBeenCalledWith({ style: "LIGHT" });
    expect(notification).toHaveBeenCalledWith({ type: "SUCCESS" });
  });

  it("stays still in an app installed before the plugin", () => {
    isPluginAvailable.mockReturnValue(false);

    tapFeedback();

    expect(impact).not.toHaveBeenCalled();
  });

  // Vitest fails the run on an unhandled rejection.
  it("swallows a device without vibration", async () => {
    isPluginAvailable.mockReturnValue(true);
    impact.mockRejectedValue(new Error("unavailable"));

    tapFeedback();
    await new Promise((resolve) => setTimeout(resolve));

    expect(impact).toHaveBeenCalled();
  });
});
