import { Domain } from "@loomkeep/shared/enums";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { DomainGated, DomainGateGuard } from "./domain-gate.guard";
import type { DomainGateService } from "./domain-gate.service";

@DomainGated(Domain.GAMES)
class GatedController {
  route() {}
}

function contextFor(userId: string): ExecutionContext {
  return {
    getHandler: () => GatedController.prototype.route,
    getClass: () => GatedController,
    switchToHttp: () => ({ getRequest: () => ({ user: { sub: userId } }) }),
  } as unknown as ExecutionContext;
}

describe("DomainGateGuard", () => {
  it("checks the controller's domain for the signed-in user", async () => {
    const assertEnabled = vi.fn().mockResolvedValue(undefined);
    const guard = new DomainGateGuard(new Reflector(), {
      assertEnabled,
    } as unknown as DomainGateService);

    await expect(guard.canActivate(contextFor("u1"))).resolves.toBe(true);
    expect(assertEnabled).toHaveBeenCalledWith("u1", Domain.GAMES);
  });

  it("lets the gate's 403 through", async () => {
    const refused = new Error("Domain 'GAMES' is disabled");
    const guard = new DomainGateGuard(new Reflector(), {
      assertEnabled: vi.fn().mockRejectedValue(refused),
    } as unknown as DomainGateService);

    await expect(guard.canActivate(contextFor("u1"))).rejects.toBe(refused);
  });
});
