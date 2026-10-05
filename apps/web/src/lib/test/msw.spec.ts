import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const server = setupServer();
const origin = "https://msw.loomkeep.test";

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("MSW REST interception", () => {
  it("rejects undeclared HTTP requests before they reach a real server", async () => {
    let requests = 0;
    const upstream = createServer((_request, response) => {
      requests++;
      response.end("unexpected network request");
    });
    upstream.listen(0, "127.0.0.1");
    await once(upstream, "listening");
    const { port } = upstream.address() as AddressInfo;
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(
        fetch(`http://127.0.0.1:${port}/undeclared`),
      ).rejects.toThrow();
      expect(requests).toBe(0);
    } finally {
      logError.mockRestore();
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
    }
  });

  it("preserves dynamic paths, query parameters and JSON mutation bodies", async () => {
    server.use(
      http.patch(`${origin}/library/:id`, async ({ params, request }) =>
        HttpResponse.json({
          id: params.id,
          region: new URL(request.url).searchParams.get("region"),
          body: await request.json(),
        }),
      ),
    );

    const response = await fetch(`${origin}/library/movie-42?region=FR`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "WATCHED" }),
    });

    expect(await response.json()).toEqual({
      id: "movie-42",
      region: "FR",
      body: { status: "WATCHED" },
    });
  });

  it("reads explicit cookies through the resolver without creating a Node cookie jar", async () => {
    server.use(
      http.get(`${origin}/cookies`, ({ cookies }) =>
        HttpResponse.json(cookies, {
          headers: { "set-cookie": "session=from-response; Path=/; Secure" },
        }),
      ),
    );

    const explicit = await fetch(`${origin}/cookies`, {
      headers: { cookie: "session=from-request" },
    });
    expect(await explicit.json()).toEqual({ session: "from-request" });

    const next = await fetch(`${origin}/cookies`);
    expect(await next.json()).toEqual({});
  });

  it("preserves empty 204 responses", async () => {
    server.use(
      http.delete(
        `${origin}/library/:id`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const response = await fetch(`${origin}/library/movie-42`, {
      method: "DELETE",
    });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });
});
