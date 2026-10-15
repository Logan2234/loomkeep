import { beforeEach, describe, expect, it, vi } from "vitest";
import { precacheAndRoute } from "workbox-precaching";

vi.mock("$app/env", () => ({ version: "test-build" }));
vi.mock("$app/manifest", () => ({
  assets: [{ path: "favicon.svg" }],
  immutable: [{ path: "_app/immutable/start.abc.js" }],
  prerendered: [{ path: "" }],
}));

vi.mock("workbox-precaching", () => ({
  cleanupOutdatedCaches: vi.fn(),
  precacheAndRoute: vi.fn(),
}));

describe("push notification locale", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it.each(["en", "fr", undefined])(
    "uses the payload locale %s without imposing French",
    async (locale) => {
      const handlers = new Map<string, (event: unknown) => void>();
      const showNotification = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("self", {
        skipWaiting: vi.fn(),
        addEventListener: (name: string, handler: (event: unknown) => void) =>
          handlers.set(name, handler),
        registration: { showNotification },
      });

      try {
        await import("./service-worker/service-worker.js");
        expect(precacheAndRoute).toHaveBeenCalledWith([
          { url: "_app/immutable/start.abc.js", revision: null },
          { url: "favicon.svg", revision: "test-build" },
          { url: "/", revision: "test-build" },
        ]);
        handlers.get("push")!({
          data: {
            json: () => ({ title: "Title", body: "Body", url: "/app", locale }),
          },
          waitUntil: vi.fn(),
        });
        expect(showNotification).toHaveBeenCalledWith(
          "Title",
          expect.objectContaining({
            body: "Body",
            lang: locale,
          }),
        );
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );
});

describe("push notification of a bell entry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  async function receive(payload: Record<string, unknown>) {
    vi.resetModules();
    const handlers = new Map<string, (event: unknown) => void>();
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    const waitUntil = vi.fn();
    vi.stubGlobal("self", {
      skipWaiting: vi.fn(),
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        handlers.set(name, handler),
      registration: { showNotification },
      location: { origin: "https://loomkeep.app" },
      navigator: { setAppBadge, clearAppBadge },
    });

    try {
      await import("./service-worker/service-worker.js");
      handlers.get("push")!({ data: { json: () => payload }, waitUntil });
      await waitUntil.mock.calls[0][0];
    } finally {
      vi.unstubAllGlobals();
    }

    return { showNotification, setAppBadge, clearAppBadge };
  }

  it("opens on the entry's page, telling the app which entry to mark read", async () => {
    const { showNotification } = await receive({
      title: "Alice replied to you",
      body: "Totally agree",
      url: "/app/media/series/42?comment=c1",
      notificationId: "n1",
    });

    expect(showNotification).toHaveBeenCalledWith(
      "Alice replied to you",
      expect.objectContaining({
        data: { url: "/app/media/series/42?comment=c1&notification=n1" },
      }),
    );
  });

  it("sets the installed app's icon badge, and clears it at zero", async () => {
    const counted = await receive({
      title: "t",
      body: "b",
      url: "/app",
      badge: 3,
    });
    expect(counted.setAppBadge).toHaveBeenCalledWith(3);

    const cleared = await receive({
      title: "t",
      body: "b",
      url: "/app",
      badge: 0,
    });
    expect(cleared.clearAppBadge).toHaveBeenCalledOnce();
  });
});
