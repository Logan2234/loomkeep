import { ErrorCode } from "@loomkeep/shared/catalog";
import { HttpStatus } from "@nestjs/common";
import { vi } from "vitest";
import { AppException } from "../common/app.exception";
import type { ReportService } from "../reports/report.service";
import type { DomainGateService } from "../users/domain-gate.service";
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
    const controller = new ReviewController(
      reviews,
      reports,
      {} as DomainGateService,
    );

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

// A review or a rating on an album went through for an account whose Music
// domain is off or locked behind premium (audit 2026-11-17, PRM-06).
describe("ReviewController.upsert", () => {
  function make(open: boolean) {
    const reviews = { upsert: vi.fn() } as unknown as ReviewService;
    const assertEnabled = open
      ? vi.fn().mockResolvedValue(undefined)
      : vi
          .fn()
          .mockRejectedValue(
            new AppException(
              HttpStatus.FORBIDDEN,
              ErrorCode.UserDomainDisabled,
            ),
          );
    const controller = new ReviewController(
      reviews,
      {} as ReportService,
      {
        assertEnabled,
      } as unknown as DomainGateService,
    );
    return { controller, reviews, assertEnabled };
  }

  it("refuses a review in a domain closed to the user", async () => {
    const { controller, reviews, assertEnabled } = make(false);
    await expect(
      controller.upsert(
        { sub: "u1" } as never,
        "MUSIC",
        "album-1",
        {} as never,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.UserDomainDisabled });
    expect(assertEnabled).toHaveBeenCalledWith("u1", "MUSIC");
    expect(reviews.upsert).not.toHaveBeenCalled();
  });

  it("checks an episode's review against the media domain", async () => {
    const { controller, reviews, assertEnabled } = make(true);
    await controller.upsert(
      { sub: "u1" } as never,
      "EPISODE",
      "ep-1",
      {} as never,
    );
    expect(assertEnabled).toHaveBeenCalledWith("u1", "MEDIA");
    expect(reviews.upsert).toHaveBeenCalled();
  });
});
