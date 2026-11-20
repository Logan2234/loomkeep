import { ErrorCode } from "@loomkeep/shared";
import { vi } from "vitest";
import type { WorkPageService } from "../links/work-page.service";
import type { AgeGateService } from "../users/age-gate.service";
import type { DomainGateService } from "../users/domain-gate.service";
import { ListWorksController } from "./list-works.controller";
import type { ListService } from "./list.service";

const user = { sub: "user-1" } as never;

function make(work: Record<string, unknown>, allowsAdult = false) {
  const lists = { addItem: vi.fn().mockResolvedValue({ id: "item-1" }) };
  const pages = { cache: vi.fn().mockResolvedValue(work) };
  const ageGate = {
    allowsAdultContent: vi.fn().mockResolvedValue(allowsAdult),
  };
  const domainGate = { assertEnabled: vi.fn().mockResolvedValue(undefined) };
  const controller = new ListWorksController(
    lists as unknown as ListService,
    pages as unknown as WorkPageService,
    ageGate as unknown as AgeGateService,
    domainGate as unknown as DomainGateService,
  );
  return { controller, lists, domainGate };
}

const WORK = {
  targetType: "GAME",
  targetId: "game-1",
  isAdult: false,
};

describe("ListWorksController.addWork", () => {
  it("refuses an 18+ work to an account without adult content", async () => {
    const { controller, lists } = make({ ...WORK, isAdult: true });

    await expect(
      controller.addWork(user, "list-1", { work: "/app/games/1" }),
    ).rejects.toMatchObject({ code: ErrorCode.ListWorkNotFound });
    expect(lists.addItem).not.toHaveBeenCalled();
  });

  it("adds an 18+ work for an account that opted in", async () => {
    const { controller, lists } = make({ ...WORK, isAdult: true }, true);

    await controller.addWork(user, "list-1", { work: "/app/games/1" });

    expect(lists.addItem).toHaveBeenCalled();
  });

  it("checks the work's domain is enabled for the account", async () => {
    const { controller, domainGate } = make(WORK);

    await controller.addWork(user, "list-1", { work: "/app/games/1" });

    expect(domainGate.assertEnabled).toHaveBeenCalledWith("user-1", "GAMES");
  });
});
