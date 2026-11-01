import { m } from "#lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppLockSetting from "./AppLockSetting.svelte";

const lock = vi.hoisted(() => ({
  supported: true,
  status: { available: true, enabled: false },
  set: vi.fn(),
}));

vi.mock("#lib/native/app-lock.js", () => ({
  isAppLockSupported: () => lock.supported,
  appLockStatus: async () => lock.status,
  setAppLock: lock.set,
}));

describe("AppLockSetting", () => {
  beforeEach(() => {
    lock.supported = true;
    lock.status = { available: true, enabled: false };
    lock.set.mockReset();
  });

  it("shows nothing outside an app that has the lock", () => {
    lock.supported = false;
    render(AppLockSetting);

    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("follows what the phone answers, not the tap", async () => {
    lock.set.mockResolvedValue({ available: true, enabled: false });
    render(AppLockSetting);

    const toggle = await screen.findByRole("switch", {
      name: m.settings_app_lock_label(),
    });
    await userEvent.click(toggle);

    expect(lock.set).toHaveBeenCalledWith(true);
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    lock.set.mockResolvedValue({ available: true, enabled: true });
    await userEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("explains why it can't be turned on without a screen lock", async () => {
    lock.status = { available: false, enabled: false };
    render(AppLockSetting);

    const toggle = await screen.findByRole("switch");
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(m.settings_app_lock_unavailable())).toBeTruthy();
  });
});
