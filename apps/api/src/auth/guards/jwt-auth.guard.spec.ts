import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Reflector } from "@nestjs/core";
import type { JwtService } from "@nestjs/jwt";
import { vi } from "vitest";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard", () => {
  it("verifies access tokens with an explicit algorithm, issuer and audience", async () => {
    const request = { headers: { authorization: "Bearer access-token" } };
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: "user-1",
        email: "alice@example.com",
      }),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(
      jwtService,
      {
        getOrThrow: vi.fn().mockReturnValue("access-secret"),
      } as unknown as ConfigService,
      {
        getAllAndOverride: vi.fn().mockReturnValue(false),
      } as unknown as Reflector,
    );
    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith("access-token", {
      secret: "access-secret",
      algorithms: ["HS256"],
      issuer: "loomkeep-api",
      audience: "loomkeep-web",
    });
  });
});
