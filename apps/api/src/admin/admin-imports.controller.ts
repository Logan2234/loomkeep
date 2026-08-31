import type {
  AdminImportRunDto,
  AdminImportSummaryDto,
  JobStatus,
  PagedResult,
} from "@loomkeep/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { parsePageQuery } from "../common/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import { buildImportSummary } from "./admin-imports.util";
import { AdminOnly } from "./admin-only.decorator";
import { AdminImportRunResponseDto } from "./dto/admin-import-run-response.dto";
import { AdminImportSummaryResponseDto } from "./dto/admin-import-summary-response.dto";

const PAGE_SIZE = 50;
const STATUSES: JobStatus[] = ["SUCCESS", "FAILURE"];

/** Audit log of committed imports, across every account. */
@AdminOnly()
@Controller("admin")
export class AdminImportsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Page-header figures over the *whole* log, ignoring the list's filters and
   * pagination — summing the 50 rows on screen would drift as soon as the admin
   * scrolls or filters.
   */
  @Get("imports/summary")
  @ApiOkResponse({ type: AdminImportSummaryResponseDto })
  async getImportSummary(): Promise<AdminImportSummaryDto> {
    const [success, failure, bySource] = await Promise.all([
      this.prisma.importRun.count({ where: { status: "SUCCESS" } }),
      this.prisma.importRun.count({ where: { status: "FAILURE" } }),
      this.prisma.importRun.groupBy({
        by: ["sourceId"],
        _count: { _all: true },
        _sum: { itemCount: true },
      }),
    ]);

    return buildImportSummary(
      success,
      failure,
      bySource.map((row) => ({
        sourceId: row.sourceId,
        runs: row._count._all,
        items: row._sum.itemCount ?? 0,
      })),
    );
  }

  /** Most recent commits first, filterable by source/status/account and paginated. */
  @Get("imports")
  @ApiOkResponse({ type: PagedResponseDto(AdminImportRunResponseDto) })
  async listImportRuns(
    @Query("source") source?: string,
    @Query("status") status?: string,
    @Query("userId") userId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PagedResult<AdminImportRunDto>> {
    const {
      skip,
      take,
      limit: pageLimit,
    } = parsePageQuery(page, limit, PAGE_SIZE);
    const where = {
      sourceId: source?.trim() || undefined,
      status: STATUSES.includes(status as JobStatus)
        ? (status as JobStatus)
        : undefined,
      userId: userId?.trim() || undefined,
    };

    const rows = await this.prisma.importRun.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: { startedAt: "desc" },
      skip,
      take: take + 1,
    });
    const hasMore = rows.length > pageLimit;
    const runs = rows.slice(0, pageLimit);

    return {
      hasMore,
      items: runs.map((r) => ({
        id: r.id,
        userId: r.userId,
        identifier: r.user?.email ?? null,
        sourceId: r.sourceId,
        status: r.status as JobStatus,
        itemCount: r.itemCount,
        overwrite: r.overwrite,
        summary: r.summary,
        error: r.error,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt.toISOString(),
      })),
    };
  }
}
