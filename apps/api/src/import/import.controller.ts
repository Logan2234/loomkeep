import type {
  ImportAvailabilityDto,
  ImportJobDto,
  ImportQuotaDto,
  ImportSource,
} from "@loomkeep/shared";
import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AnalyzeImportDto } from "./dto/analyze-import.dto";
import { CommitImportDto } from "./dto/commit-import.dto";
import { ImportAvailabilityResponseDto } from "./dto/import-availability-response.dto";
import { ImportJobResponseDto } from "./dto/import-job-response.dto";
import { ImportQuotaResponseDto } from "./dto/import-quota-response.dto";
import { ImportJobService } from "./import-job.service";

/**
 * One generic import surface for every source. `:source` selects the plugged-in
 * {@link ImportSource} (tvtime, storygraph, goodreads, steam, …); analyze and
 * commit both return a job to poll at `GET /import/:source/:jobId`.
 */
@Controller("import")
export class ImportController {
  constructor(private readonly jobs: ImportJobService) {}

  /**
   * Which config-dependent sources (their own provider key/OAuth app, not the
   * app's core catalogue keys) are actually usable on this deployment — lets
   * the import list grey out a built-but-unconfigured source instead of
   * sending the user into a wizard that can only fail.
   */
  @Get("availability")
  @ApiOkResponse({ type: ImportAvailabilityResponseDto })
  availability(): ImportAvailabilityDto {
    return this.jobs.getAvailability();
  }

  /** Per domain, whether this user has already used their one free import in it. */
  @Get("quota")
  @ApiOkResponse({ type: ImportQuotaResponseDto })
  quota(@CurrentUser() user: JwtPayload): Promise<ImportQuotaDto> {
    return this.jobs.getQuota(user.sub);
  }

  /** Analyse an export and build a reconciliation plan (writes nothing). */
  @Post(":source/analyze")
  @ApiCreatedResponse({ type: ImportJobResponseDto })
  analyze(
    @CurrentUser() user: JwtPayload,
    @Param("source") source: ImportSource,
    @Body() dto: AnalyzeImportDto,
  ): Promise<ImportJobDto> {
    return this.jobs.startAnalyze(user.sub, source, dto);
  }

  /** Commit an analysed import with the user's reconciliation decisions. */
  @Post(":source/:jobId/commit")
  @ApiCreatedResponse({ type: ImportJobResponseDto })
  commit(
    @CurrentUser() user: JwtPayload,
    @Param("source") source: ImportSource,
    @Param("jobId") jobId: string,
    @Body() dto: CommitImportDto,
  ): ImportJobDto {
    return this.jobs.commit(user.sub, source, jobId, dto);
  }

  /** Poll progress and, once finished, the plan or report. */
  @Get(":source/:jobId")
  @ApiOkResponse({ type: ImportJobResponseDto })
  status(
    @CurrentUser() user: JwtPayload,
    @Param("jobId") jobId: string,
  ): ImportJobDto {
    return this.jobs.getJob(user.sub, jobId);
  }
}
