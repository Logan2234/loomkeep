import { ErrorCode } from "@loomkeep/shared/catalog";
import { HttpStatus } from "@nestjs/common";
import { vi } from "vitest";
import { AppException } from "../common/app.exception";
import type { ReportService } from "../reports/report.service";
import type { DomainGateService } from "../users/domain-gate.service";
import { ListController } from "./list.controller";
import type { ListService } from "./list.service";

// An album went onto a list for an account whose Music domain is off or
// locked behind premium (audit 2026-11-17, PRM-06).
describe("ListController.addItem", () => {
  it("refuses a work from a domain closed to the user", async () => {
    const lists = { addItem: vi.fn() } as unknown as ListService;
    const assertEnabled = vi
      .fn()
      .mockRejectedValue(
        new AppException(HttpStatus.FORBIDDEN, ErrorCode.UserDomainDisabled),
      );
    const controller = new ListController(
      lists,
      {} as ReportService,
      {
        assertEnabled,
      } as unknown as DomainGateService,
    );

    await expect(
      controller.addItem({ sub: "u1" } as never, "list-1", {
        targetType: "MUSIC",
        targetId: "album-1",
      }),
    ).rejects.toMatchObject({ code: ErrorCode.UserDomainDisabled });
    expect(assertEnabled).toHaveBeenCalledWith("u1", "MUSIC");
    expect(lists.addItem).not.toHaveBeenCalled();
  });
});
