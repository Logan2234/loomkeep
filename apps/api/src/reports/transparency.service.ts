import type { ModerationTransparencyDto } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { utcYearRange } from "../common/date.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  summarizeMeasures,
  summarizeReports,
  transparencyYears,
} from "./transparency.util";

@Injectable()
export class TransparencyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Falls back to the current year when `requested` isn't one of the listed years. */
  async forYear(
    requested: number | undefined,
    now = new Date(),
  ): Promise<ModerationTransparencyDto> {
    const currentYear = now.getUTCFullYear();
    const years = transparencyYears(currentYear, await this.firstYear());
    const year =
      requested !== undefined && years.includes(requested)
        ? requested
        : currentYear;
    const period = utcYearRange(year);

    const [reports, decisions] = await Promise.all([
      this.prisma.report.findMany({
        where: { createdAt: period },
        select: {
          category: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          _count: { select: { moderationDecisions: true } },
        },
      }),
      this.prisma.moderationDecision.findMany({
        where: { decidedAt: period },
        select: { measure: true, legalBasis: true, reportId: true },
      }),
    ]);

    return {
      year,
      years,
      reports: summarizeReports(
        reports.map(({ _count, ...report }) => ({
          ...report,
          decisionCount: _count.moderationDecisions,
        })),
      ),
      measures: summarizeMeasures(decisions),
    };
  }

  private async firstYear(): Promise<number | null> {
    const [firstReport, firstDecision] = await Promise.all([
      this.prisma.report.findFirst({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      this.prisma.moderationDecision.findFirst({
        orderBy: { decidedAt: "asc" },
        select: { decidedAt: true },
      }),
    ]);
    const dates = [firstReport?.createdAt, firstDecision?.decidedAt].filter(
      (d): d is Date => d !== undefined,
    );
    return dates.length > 0
      ? Math.min(...dates.map((d) => d.getUTCFullYear()))
      : null;
  }
}
