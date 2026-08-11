import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type { ImportJobDto, ImportSource } from "@loomkeep/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { AnalyzeImportDto } from "./dto/analyze-import.dto";
import { CommitImportDto } from "./dto/commit-import.dto";
import { ImportJobService } from "./import-job.service";

/**
 * One generic import surface for every source. `:source` selects the plugged-in
 * {@link ImportSource} (tvtime, storygraph, goodreads, steam, …); analyze and
 * commit both return a job to poll at `GET /import/:source/:jobId`.
 */
@Controller("import")
export class ImportController {
  constructor(private readonly jobs: ImportJobService) {}

  /** Analyse an export and build a reconciliation plan (writes nothing). */
  @Post(":source/analyze")
  analyze(
    @CurrentUser() user: JwtPayload,
    @Param("source") source: ImportSource,
    @Body() dto: AnalyzeImportDto,
  ): ImportJobDto {
    return this.jobs.startAnalyze(user.sub, source, dto);
  }

  /** Commit an analysed import with the user's reconciliation decisions. */
  @Post(":source/:jobId/commit")
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
  status(
    @CurrentUser() user: JwtPayload,
    @Param("jobId") jobId: string,
  ): ImportJobDto {
    return this.jobs.getJob(user.sub, jobId);
  }
}
