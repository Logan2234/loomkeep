import { afterEach, describe, expect, it, vi } from "vitest";

const { events } = vi.hoisted(() => ({ events: [] as unknown[] }));

vi.mock("@sentry/sveltekit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sentry/sveltekit")>();
  return {
    ...actual,
    init: (options: Parameters<typeof actual.init>[0]) =>
      actual.init({
        ...options,
        transport: () => ({
          send: async (envelope) => {
            events.push(...envelope[1].map(([, payload]) => payload));
            return { statusCode: 200 };
          },
          flush: async () => true,
        }),
      }),
  };
});

let sdk: typeof import("@sentry/sveltekit") | undefined;

async function loadHooks(dsn: string | undefined) {
  vi.resetModules();
  vi.doMock("$app/env/public", () => ({ PUBLIC_GLITCHTIP_WEB_DSN: dsn }));
  sdk = await import("@sentry/sveltekit");
  return import("./hooks.client");
}

afterEach(async () => {
  await sdk?.close();
  sdk?.getCurrentScope().setClient(undefined);
  events.length = 0;
  vi.doUnmock("$app/env/public");
});

describe("client error reporting", { timeout: 20_000 }, () => {
  it("initializes with SvelteKit 3 and sends errors without browser tracing", async () => {
    await loadHooks(
      "https://0123456789abcdef0123456789abcdef@glitchtip.example/2",
    );

    expect(
      sdk!.getClient()?.getIntegrationByName("BrowserTracing"),
    ).toBeUndefined();
    expect(
      sdk!.getClient()?.getIntegrationByName("GlobalHandlers"),
    ).toBeDefined();
    sdk!.captureException(new Error("Regression test error"));
    expect(await sdk!.flush(2_000)).toBe(true);
    expect(events).toContainEqual(
      expect.objectContaining({
        exception: expect.objectContaining({
          values: expect.arrayContaining([
            expect.objectContaining({ value: "Regression test error" }),
          ]),
        }),
      }),
    );
  });

  it.each([undefined, ""])(
    "leaves reporting disabled for DSN %s",
    async (dsn) => {
      await loadHooks(dsn);
      expect(sdk!.getClient()).toBeUndefined();
    },
  );
});
