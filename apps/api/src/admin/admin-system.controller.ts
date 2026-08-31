import type {
  AdminBackupFileContentDto,
  AdminBackupFileDto,
  AdminOverviewDto,
  SchemaGraphResponseDto,
  ServiceStatusResponseDto,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminOnly } from "./admin-only.decorator";
import { AdminOverviewService } from "./admin-overview.service";
import { AdminService } from "./admin.service";
import { BackupService } from "./backup.service";
import { AdminBackupFileContentResponseDto } from "./dto/admin-backup-file-content-response.dto";
import { AdminBackupFileResponseDto } from "./dto/admin-backup-file-response.dto";
import { AdminOverviewResponseDto } from "./dto/admin-overview-response.dto";
import { RestoreBackupDto } from "./dto/restore-backup.dto";
import { SchemaGraphResultResponseDto } from "./dto/schema-graph-response.dto";
import { ServiceStatusListResponseDto } from "./dto/service-status-response.dto";

/** Instance-wide system info: backup, dependency health, schema, overview. */
@AdminOnly()
@Controller("admin")
export class AdminSystemController {
  constructor(
    private readonly admin: AdminService,
    private readonly overview: AdminOverviewService,
    private readonly backup: BackupService,
  ) {}

  /** Persisted backup dumps on disk (BACKUP_DIR), most recent first — up to 7, pruned by the daily job. */
  @Get("backup/files")
  @ApiOkResponse({ type: AdminBackupFileResponseDto, isArray: true })
  listBackupFiles(): Promise<AdminBackupFileDto[]> {
    return this.backup.listFiles();
  }

  /** Full SQL content of one persisted backup, for download. */
  @Get("backup/files/:id")
  @ApiOkResponse({ type: AdminBackupFileContentResponseDto })
  getBackupFile(@Param("id") id: string): Promise<AdminBackupFileContentDto> {
    return this.backup.readFile(id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("backup/files/:id")
  async deleteBackupFile(@Param("id") id: string): Promise<void> {
    await this.backup.deleteFile(id);
  }

  /**
   * Replaces the entire instance database with a previously downloaded dump.
   * Irreversible — the frontend requires a typed confirmation before calling this.
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("backup/restore")
  async restoreBackup(@Body() dto: RestoreBackupDto): Promise<void> {
    await this.backup.restore(dto.sql);
  }

  /** Health of every external dependency (config presence + live probe). */
  @Get("services")
  @ApiOkResponse({ type: ServiceStatusListResponseDto })
  getServices(): Promise<ServiceStatusResponseDto> {
    return this.admin.getServicesStatus();
  }

  /** Locally-generated architecture diagrams (DB ERD, module graph). */
  @Get("schema")
  @ApiOkResponse({ type: SchemaGraphResultResponseDto })
  getSchema(): Promise<SchemaGraphResponseDto> {
    return this.admin.getSchemaGraphs();
  }

  /**
   * The few counters the admin dashboard strip and /admin/communications read.
   * Instance *statistics* live on /admin/stats (AdminStatsController), section
   * by section — this is deliberately not a statistics endpoint.
   */
  @Get("overview")
  @ApiOkResponse({ type: AdminOverviewResponseDto })
  getOverview(): Promise<AdminOverviewDto> {
    return this.overview.getOverview();
  }
}
