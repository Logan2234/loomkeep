import type {
  AdminImportDetailDto,
  AdminImportDetails,
  AdminImportRunDto,
  AdminImportStatus,
  AdminImportSummaryDto,
  PagedResult,
} from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import { Controller, Get, HttpStatus, Param, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { DEFAULT_PAGE_SIZE, parsePageQuery } from "../common/pagination.util";
import { ImportJobService } from "../import/import-job.service";
import { PrismaService } from "../prisma/prisma.service";
import { buildImportSummary } from "./admin-imports.util";
import { AdminOnly } from "./admin-only.decorator";
import {
  AdminImportDetailResponseDto,
  AdminImportRunResponseDto,
} from "./dto/admin-import-run-response.dto";
import { AdminImportSummaryResponseDto } from "./dto/admin-import-summary-response.dto";

const STATUSES: AdminImportStatus[] = ["RUNNING", "SUCCESS", "FAILURE"];
const IMPORT_SELECT = {
  id: true,
  userId: true,
  sourceId: true,
  status: true,
  itemCount: true,
  overwrite: true,
  summary: true,
  error: true,
  startedAt: true,
  finishedAt: true,
  user: { select: { email: true } },
} as const;
type ImportRow = Prisma.ImportRunGetPayload<{ select: typeof IMPORT_SELECT }>;

function toRunDto(row: ImportRow): AdminImportRunDto {
  return {
    id: row.id,
    userId: row.userId,
    identifier: row.user?.email ?? null,
    sourceId: row.sourceId,
    status: row.status as AdminImportStatus,
    itemCount: row.itemCount,
    overwrite: row.overwrite,
    summary: row.summary,
    error: row.error,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt.toISOString(),
  };
}

function dateFilter(
  from?: string,
  to?: string,
): { gte?: Date; lt?: Date } | undefined {
  const start = from ? new Date(from) : undefined;
  const end = to ? new Date(to) : undefined;

  if (
    (start && Number.isNaN(start.getTime())) ||
    (end && Number.isNaN(end.getTime())) ||
    (start && end && start >= end)
  ) {
    throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.ValidationFailed);
  }

  return start || end ? { gte: start, lt: end } : undefined;
}

/** Audit log of committed imports and live analyses, across every account. */
@AdminOnly()
@Controller("admin")
export class AdminImportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imports: ImportJobService,
  ) {}

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

  /** Active analyses and commits first, followed by finished imports; all filters precede pagination. */
  @Get("imports")
  @ApiOkResponse({ type: PagedResponseDto(AdminImportRunResponseDto) })
  async listImportRuns(
    @Query("source") source?: string,
    @Query("status") status?: string,
    @Query("userId") userId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<PagedResult<AdminImportRunDto>> {
    const {
      skip,
      take,
      limit: pageLimit,
    } = parsePageQuery(page, limit, DEFAULT_PAGE_SIZE);
    const startedAt = dateFilter(from, to);
    const where = {
      sourceId: source?.trim() || undefined,
      status: STATUSES.includes(status as AdminImportStatus)
        ? (status as AdminImportStatus)
        : undefined,
      userId: userId?.trim() || undefined,
      ...(startedAt ? { startedAt } : {}),
    };
    const active = (
      where.status && where.status !== "RUNNING"
        ? []
        : this.imports.listRunningImports()
    ).filter(
      (run) =>
        (!where.sourceId || run.sourceId === where.sourceId) &&
        (!where.userId || run.userId === where.userId) &&
        (!startedAt?.gte || new Date(run.startedAt) >= startedAt.gte) &&
        (!startedAt?.lt || new Date(run.startedAt) < startedAt.lt),
    );
    const pageActive = active.slice(skip, skip + take + 1);
    const users = pageActive.length
      ? await this.prisma.user.findMany({
          where: {
            id: {
              in: pageActive.flatMap((run) => (run.userId ? [run.userId] : [])),
            },
          },
          select: { id: true, email: true },
        })
      : [];
    const running = pageActive.map((run) => ({
      ...run,
      identifier: users.find((user) => user.id === run.userId)?.email ?? null,
    }));
    const rows =
      where.status === "RUNNING" || running.length > pageLimit
        ? []
        : await this.prisma.importRun.findMany({
            where,
            select: IMPORT_SELECT,
            orderBy: { startedAt: "desc" },
            skip: Math.max(0, skip - active.length),
            take: pageLimit - running.length + 1,
          });
    const combined = [...running, ...rows.map(toRunDto)];
    return {
      items: combined.slice(0, pageLimit),
      hasMore: combined.length > pageLimit,
    };
  }

  @Get("imports/:id")
  @ApiOkResponse({ type: AdminImportDetailResponseDto })
  async importDetail(@Param("id") id: string): Promise<AdminImportDetailDto> {
    const running = this.imports
      .listRunningImports()
      .find((run) => run.id === id);

    if (running) {
      const user = running.userId
        ? await this.prisma.user.findUnique({
            where: { id: running.userId },
            select: { email: true },
          })
        : null;
      return {
        ...running,
        identifier: user?.email ?? null,
        details: user ? this.imports.runningImportDetails(id) : null,
      };
    }

    const row = await this.prisma.importRun.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    });
    if (!row)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ImportJobNotFound);
    return {
      ...toRunDto(row),
      details: row.details as unknown as AdminImportDetails | null,
    };
  }
}
