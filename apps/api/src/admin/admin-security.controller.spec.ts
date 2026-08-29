import type { SecurityEventService } from "../security/security-event.service";
import { AdminSecurityController } from "./admin-security.controller";

function makeController() {
  const securityEvents = {
    list: jest.fn().mockResolvedValue({ items: [], hasMore: false }),
  } as unknown as SecurityEventService;

  const controller = new AdminSecurityController(securityEvents);
  return { controller, securityEvents };
}

describe("AdminSecurityController.getSecurityEvents", () => {
  it("ignores an unknown type filter instead of forwarding it", async () => {
    const { controller, securityEvents } = makeController();

    await controller.getSecurityEvents("NOT_A_REAL_TYPE", undefined, "2");

    expect(securityEvents.list).toHaveBeenCalledWith({
      type: undefined,
      identifier: undefined,
      page: 2,
      limit: 50,
    });
  });

  it("forwards a known type and identifier filter", async () => {
    const { controller, securityEvents } = makeController();

    await controller.getSecurityEvents("LOGIN_FAILED", " alice@example.com ");

    expect(securityEvents.list).toHaveBeenCalledWith({
      type: "LOGIN_FAILED",
      identifier: "alice@example.com",
      page: 1,
      limit: 50,
    });
  });
});
