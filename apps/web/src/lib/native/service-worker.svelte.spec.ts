import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./service-worker";

const { native } = vi.hoisted(() => ({ native: { value: false } }));
vi.mock("./app-shell", () => ({ isNativeApp: () => native.value }));

const unregister = vi.fn(() => Promise.resolve(true));
const serviceWorker = {
  register: vi.fn(() => Promise.resolve()),
  getRegistrations: vi.fn(() => Promise.resolve([{ unregister }])),
};
Object.defineProperty(navigator, "serviceWorker", {
  value: serviceWorker,
  configurable: true,
});

afterEach(() => {
  vi.clearAllMocks();
  native.value = false;
});

describe("registerServiceWorker", () => {
  it("registers the PWA worker in a browser, as a module in dev", () => {
    registerServiceWorker(true);
    registerServiceWorker(false);

    expect(serviceWorker.register).toHaveBeenNthCalledWith(
      1,
      "/service-worker.js",
      { type: "module" },
    );
    expect(serviceWorker.register).toHaveBeenNthCalledWith(
      2,
      "/service-worker.js",
      { type: "classic" },
    );
  });

  it("skips it in the Android app and removes an earlier registration", async () => {
    native.value = true;

    registerServiceWorker(false);

    expect(serviceWorker.register).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(unregister).toHaveBeenCalledOnce());
  });
});
