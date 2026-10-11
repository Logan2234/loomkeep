import { vi, type Mock } from "vitest";

export function mockFetchByUrl(
  routes: Record<string, unknown> | readonly [string, unknown][],
): Mock {
  const entries = Array.isArray(routes) ? routes : Object.entries(routes);
  const fn = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const match = entries.find(([part]) => url.includes(part));
    if (!match) throw new Error(`Unexpected fetch call in test: ${url}`);
    if (match[1] instanceof Response) return Promise.resolve(match[1]);
    return Promise.resolve(
      new Response(JSON.stringify(match[1]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}
