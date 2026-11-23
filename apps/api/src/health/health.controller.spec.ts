import type {
  HealthCheckService,
  PrismaHealthIndicator,
} from "@nestjs/terminus";
import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { HealthController } from "./health.controller";

// The memory thresholds lived in the same check as the database: an API
// over 512 MB answered 503, marked its container unhealthy and made a deploy
// roll back, though it served requests fine (audit 2026-11-17, INF-11).
describe("HealthController", () => {
  function make() {
    const pingCheck = vi.fn().mockResolvedValue({ database: { status: "up" } });
    const check = vi.fn(async (indicators: (() => Promise<unknown>)[]) => {
      await Promise.all(indicators.map((indicator) => indicator()));
      return { status: "ok" };
    });
    const controller = new HealthController(
      { check } as unknown as HealthCheckService,
      { pingCheck } as unknown as PrismaHealthIndicator,
      {} as PrismaService,
    );
    return { controller, check, pingCheck };
  }

  it("is ready once the database answers, whatever the memory use", async () => {
    const { controller, check, pingCheck } = make();

    await expect(controller.check()).resolves.toEqual({ status: "ok" });
    expect(pingCheck).toHaveBeenCalledOnce();
    expect(check.mock.calls[0][0]).toHaveLength(1);
  });

  it("answers live without checking anything", () => {
    const { controller, check } = make();

    expect(controller.live()).toEqual({ status: "ok" });
    expect(check).not.toHaveBeenCalled();
  });
});
