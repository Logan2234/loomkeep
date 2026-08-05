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
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AdminBackupFileContentDto,
  AdminBackupFileDto,
  AdminOverviewDto,
  AdminVersionDto,
  SchemaGraphResponseDto,
  ServiceStatusResponseDto,
} from "@tracklore/shared";
import { AdminOnly } from "./admin-only.decorator";
import { AdminService } from "./admin.service";
import { AdminOverviewService } from "./admin-overview.service";
import { BackupService } from "./backup.service";
import { RestoreBackupDto } from "./dto/restore-backup.dto";

// process.cwd() is apps/api in both dev (pnpm --filter) and the Docker image
// (WORKDIR) — same trick as admin.service.ts's DOCS_DIR.
const ROOT_PACKAGE_JSON = join(process.cwd(), "..", "..", "package.json");

/** Instance-wide system info: version, backup, dependency health, schema, overview. */
@AdminOnly()
@Controller("admin")
export class AdminSystemController {
  constructor(
    private readonly admin: AdminService,
    private readonly overview: AdminOverviewService,
    private readonly backup: BackupService,
  ) {}

  /** The running app's version (monorepo root package.json), for the admin/settings footer. */
  @Get("version")
  async getVersion(): Promise<AdminVersionDto> {
    const raw = await readFile(ROOT_PACKAGE_JSON, "utf-8");
    const { version } = JSON.parse(raw) as { version: string };
    return { version };
  }

  /** Persisted backup dumps on disk (BACKUP_DIR), most recent first — up to 7, pruned by the daily job. */
  @Get("backup/files")
  listBackupFiles(): Promise<AdminBackupFileDto[]> {
    return this.backup.listFiles();
  }

  /** Full SQL content of one persisted backup, for download. */
  @Get("backup/files/:id")
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
  getServices(): Promise<ServiceStatusResponseDto> {
    return this.admin.getServicesStatus();
  }

  /** Locally-generated architecture diagrams (DB ERD, module graph). */
  @Get("schema")
  getSchema(): Promise<SchemaGraphResponseDto> {
    return this.admin.getSchemaGraphs();
  }

  /**
   * The few counters the admin dashboard strip and /admin/communications read.
   * Instance *statistics* live on /admin/stats (AdminStatsController), section
   * by section — this is deliberately not a statistics endpoint.
   */
  @Get("overview")
  getOverview(): Promise<AdminOverviewDto> {
    return this.overview.getOverview();
  }
}
