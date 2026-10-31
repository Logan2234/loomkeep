import { afterEach, describe, expect, it, vi } from "vitest";
import { successFeedback, tapFeedback } from "./haptics";

const { isPluginAvailable, impact, notification, tap, success } = vi.hoisted(
  () => ({
    isPluginAvailable: vi.fn(),
    impact: vi.fn(),
    notification: vi.fn(),
    tap: vi.fn(),
    success: vi.fn(),
  }),
);
vi.mock("@capacitor/core", () => ({
  Capacitor: { isPluginAvailable },
  registerPlugin: () => ({ tap, success }),
}));
vi.mock("@capacitor/haptics", () => ({
  Haptics: { impact, notification },
  ImpactStyle: { Light: "LIGHT" },
  NotificationType: { Success: "SUCCESS" },
}));

afterEach(() => vi.resetAllMocks());

describe("haptic feedback", () => {
  it("lets Android play it where the APK can: raw vibrations stay silent on some phones", () => {
    isPluginAvailable.mockReturnValue(true);
    tap.mockResolvedValue(undefined);
    success.mockResolvedValue(undefined);

    tapFeedback();
    successFeedback();

    expect(tap).toHaveBeenCalledOnce();
    expect(success).toHaveBeenCalledOnce();
    expect(impact).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
  });

  it("falls back to the plugin's vibrations in an older APK", () => {
    isPluginAvailable.mockImplementation((name) => name === "Haptics");
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
    isPluginAvailable.mockImplementation((name) => name === "Haptics");
    impact.mockRejectedValue(new Error("unavailable"));

    tapFeedback();
    await new Promise((resolve) => setTimeout(resolve));

    expect(impact).toHaveBeenCalled();
  });
});
