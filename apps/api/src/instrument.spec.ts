import * as Sentry from "@sentry/node";
import { once } from "node:events";
import { createServer } from "node:http";
import { vi } from "vitest";

type Envelope = Parameters<
  ReturnType<typeof Sentry.makeNodeTransport>["send"]
>[0];

const { envelopes, init } = vi.hoisted(() => ({
  envelopes: [] as Envelope[],
  init: vi.fn(),
}));

// Keep the actual SDK and its HTTP instrumentation; replace only delivery
// so the production configuration can be exercised without an external DSN.
vi.mock("@sentry/node", async (importOriginal) => {
  const actual = await importOriginal<typeof Sentry>();
  return {
    ...actual,
    init: init.mockImplementation((options: Sentry.NodeOptions) =>
      actual.init({
        ...options,
        transport: () => ({
          send: async (envelope) => {
            envelopes.push(envelope);
            return { statusCode: 200 };
          },
          flush: async () => true,
        }),
      }),
    ),
  };
});

describe("production error reporting", () => {
  beforeEach(() => {
    vi.resetModules();
    init.mockClear();
    envelopes.length = 0;
  });

  afterEach(async () => {
    await Sentry.close(2000);
    vi.unstubAllEnvs();
  });

  it("does not initialize without a DSN", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GLITCHTIP_API_DSN", "");
    await import("./instrument.js");
    expect(init).not.toHaveBeenCalled();
  });

  it("does not initialize in development with a DSN", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("GLITCHTIP_API_DSN", "https://public@example.com/1");
    await import("./instrument.js");
    expect(init).not.toHaveBeenCalled();
  });

  it("delivers an HTTP error without private request data or unsupported envelopes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GLITCHTIP_API_DSN", "https://public@example.com/1");
    // GitHub supplies a release automatically. Exercise it locally too:
    // process sessions are otherwise silently dropped when no release exists.
    vi.stubEnv("SENTRY_RELEASE", "loomkeep-instrumentation-regression");
    await import("./instrument.js");

    const server = createServer((request, response) => {
      Sentry.captureException(new Error("Loomkeep instrumentation regression"));
      request.resume();
      response.writeHead(500);
      response.end("Internal server error");
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    try {
      const address = server.address();

      if (!address || typeof address === "string") {
        throw new Error("Expected a TCP listener");
      }

      const response = await fetch(
        `http://127.0.0.1:${address.port}/auth?private_marker=query-private`,
        {
          method: "POST",
          headers: {
            cookie: "private_marker=cookie-private",
            "x-private-marker": "header-private",
            "content-type": "application/json",
          },
          body: JSON.stringify({ private_marker: "body-private" }),
        },
      );
      await response.text();
      expect(response.status).toBe(500);
      expect(await Sentry.flush(2000)).toBe(true);

      const items: Envelope[1][number][] = [];

      for (const [, envelopeItems] of envelopes) {
        items.push(...envelopeItems);
      }

      const errors = items.filter(([header]) => header.type === "event");
      expect(errors).toHaveLength(1);
      const event = errors[0][1] as Sentry.Event;
      expect(event.release).toBe("loomkeep-instrumentation-regression");
      expect(event.exception?.values?.[0].value).toBe(
        "Loomkeep instrumentation regression",
      );
      expect(event.request?.url).toBe(`http://127.0.0.1:${address.port}/auth`);
      expect(event.user?.ip_address).toBeUndefined();
      const payload = JSON.stringify(envelopes);

      for (const marker of [
        "query-private",
        "cookie-private",
        "header-private",
        "body-private",
      ]) {
        expect(payload).not.toContain(marker);
      }

      for (const [header] of items) {
        expect(["session", "sessions", "span", "transaction"]).not.toContain(
          header.type,
        );
      }
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
