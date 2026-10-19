import type { FastifyInstance, RouteOptions } from "fastify";
import { vi } from "vitest";
import { BODY_LIMITS, registerBodyLimits } from "./body-limit";

function capturedHook(): (route: Partial<RouteOptions>) => void {
  const addHook = vi.fn();
  registerBodyLimits({ addHook } as unknown as FastifyInstance);
  return addHook.mock.calls[0][1];
}

describe("registerBodyLimits", () => {
  it("raises the limit only on the routes that carry large bodies", () => {
    const onRoute = capturedHook();
    const imports: Partial<RouteOptions> = {
      url: "/api/import/:source/analyze",
    };
    const login: Partial<RouteOptions> = { url: "/api/auth/login" };

    onRoute(imports);
    onRoute(login);

    expect(imports.bodyLimit).toBe(25 * 1024 * 1024);
    expect(login.bodyLimit).toBeUndefined();
  });

  it("leaves a limit a route already set alone", () => {
    const onRoute = capturedHook();
    const route: Partial<RouteOptions> = {
      url: "/api/admin/backup/restore",
      bodyLimit: 1024,
    };

    onRoute(route);

    expect(route.bodyLimit).toBe(1024);
  });

  it("only names routes under the global prefix", () => {
    for (const url of Object.keys(BODY_LIMITS)) {
      expect(url.startsWith("/api/")).toBe(true);
    }
  });
});
