import { ErrorCode } from "@loomkeep/shared/catalog";
import { HttpStatus } from "@nestjs/common";
import { vi } from "vitest";
import { AppException } from "../common/app.exception";
import type { ReportService } from "../reports/report.service";
import { ReviewController } from "./review.controller";
import type { ReviewService } from "./review.service";

// Reporting went through on a review the viewer couldn't see, which
// confirmed it existed (audit 2026-11-17, SEC-29).
describe("ReviewController.report", () => {
  it("files nothing on a review the viewer can't see", async () => {
    const reviews = {
      assertVisibleTo: vi
        .fn()
        .mockRejectedValue(
          new AppException(HttpStatus.NOT_FOUND, ErrorCode.ReviewNotFound),
        ),
    } as unknown as ReviewService;
    const reports = { create: vi.fn() } as unknown as ReportService;
    const controller = new ReviewController(reviews, reports);

    await expect(
      controller.report({ sub: "viewer" } as never, "r1", {
        category: "SPAM",
        motif: "SPAM_PROMOTIONAL",
      } as never),
    ).rejects.toMatchObject({ code: ErrorCode.ReviewNotFound });
    expect(reviews.assertVisibleTo).toHaveBeenCalledWith("viewer", "r1");
    expect(reports.create).not.toHaveBeenCalled();
  });
});
