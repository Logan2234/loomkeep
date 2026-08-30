import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("workbox-precaching", () => ({
  cleanupOutdatedCaches: vi.fn(),
  precacheAndRoute: vi.fn(),
}));

describe("push notification locale", () => {
  beforeEach(() => vi.resetModules());

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
        await import("./service-worker");
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
