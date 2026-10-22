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
  // Same registration as SvelteKit's own: the built worker is an ES module.
  it("registers the PWA worker as a module once the page has loaded", () => {
    registerServiceWorker();
    expect(serviceWorker.register).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("load"));

    expect(serviceWorker.register).toHaveBeenCalledWith("/service-worker.js", {
      type: "module",
    });
  });

  it("skips it in the Android app and removes an earlier registration", async () => {
    native.value = true;

    registerServiceWorker();
    window.dispatchEvent(new Event("load"));

    expect(serviceWorker.register).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(unregister).toHaveBeenCalledOnce());
  });
});
