import {
  ErrorCode,
  type AdminBackupFileContentDto,
  type AdminBackupFileDto,
} from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AppException } from "../common/app.exception";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { PrismaService } from "../prisma/prisma.service";

/** How many dumps are kept on disk — older ones are purged after each run. */
const KEEP = 7;

/**
 * Shells out to the Postgres client tools (pg_dump/psql) rather than
 * reimplementing a dump in Prisma: it's the only way to get a complete,
 * faithfully-restorable snapshot (every table, type, constraint) without
 * hand-maintaining an exporter that tracks every future migration. Plain-SQL
 * format (not pg_dump's custom binary format) so a dump travels as a normal
 * string through the same JSON request/response pattern the rest of the app
 * already uses — no multipart upload needed.
 *
 * Dumps taken by the daily cron (or triggered on demand via the same method,
 * from /admin/jobs or the Sauvegarde page) are written to BACKUP_DIR — a
 * dedicated Docker volume in self-host, separate from the Postgres data
 * volume it backs up, so a corrupt DB doesn't take its own backups down with
 * it. Only the {@link KEEP} most recent are kept.
 *
 * Every dump is encrypted (age, ASCII-armored) for BACKUP_ENCRYPTION_PUBLIC_KEY
 * before it ever touches disk (LK-C20) — a plain-SQL dump on disk is the
 * entire user database (emails, password hashes, birth dates, full watch
 * history) sitting in the clear. Only the *public* key lives on this
 * instance; nothing here can decrypt a dump back, by design — restoring
 * requires the operator to decrypt it themselves (`age -d`) with the
 * private key, which never touches this server, before uploading the
 * plain SQL back through {@link restore}.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobRuns: JobRunService,
    private readonly configService: ConfigService,
  ) {}

  private get dir(): string {
    return process.env.BACKUP_DIR ?? join(process.cwd(), "backups");
  }

  /** Ad-hoc dump, not persisted — used by {@link runScheduled} and restore-from-upload flows. */
  async dump(): Promise<string> {
    return this.run("pg_dump", [
      "--no-owner",
      "--no-privileges",
      "--clean",
      "--if-exists",
    ]);
  }

  /**
   * Replaces the entire database with `sql` (a dump produced by {@link dump}),
   * then re-applies any migration shipped since that dump was taken — the
   * dump's own `_prisma_migrations` table only reflects schema state as of
   * that snapshot, so a restore from an older backup would otherwise leave
   * the running app's Prisma client out of sync with the just-restored schema.
   */
  async restore(sql: string): Promise<void> {
    await this.run("psql", ["--set", "ON_ERROR_STOP=1"], sql);
    await this.run("pnpm", ["exec", "prisma", "migrate", "deploy"]);
  }

  /** Daily 3h dump to disk, pruned to the {@link KEEP} most recent. Also the manual "Sauvegarder maintenant" trigger. */
  @Cron("0 3 * * *")
  async runScheduled(): Promise<AdminBackupFileDto> {
    return this.jobRuns.record(
      JOB_KEYS.BACKUP,
      () => this.writeBackup(),
      (file) => `${file.filename} (${formatBytes(file.sizeBytes)})`,
    );
  }

  async listFiles(): Promise<AdminBackupFileDto[]> {
    const rows = await this.prisma.backupFile.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDto);
  }

  async readFile(id: string): Promise<AdminBackupFileContentDto> {
    const row = await this.prisma.backupFile.findUnique({ where: { id } });
    if (!row)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AdminBackupNotFound,
      );
    const content = await readFile(join(this.dir, row.filename), "utf-8");
    return { filename: row.filename, content };
  }

  async deleteFile(id: string): Promise<void> {
    const row = await this.prisma.backupFile.findUnique({ where: { id } });
    if (!row)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AdminBackupNotFound,
      );
    await rm(join(this.dir, row.filename), { force: true });
    await this.prisma.backupFile.delete({ where: { id } });
  }

  private async writeBackup(): Promise<AdminBackupFileDto> {
    const sql = await this.dump();
    const encrypted = await this.encrypt(sql);
    const filename = `loomkeep-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.sql.age`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, filename), encrypted, "utf-8");

    const row = await this.prisma.backupFile.create({
      data: { filename, sizeBytes: Buffer.byteLength(encrypted, "utf-8") },
    });
    await this.prune();
    return toDto(row);
  }

  /**
   * Encrypts `sql` for BACKUP_ENCRYPTION_PUBLIC_KEY. ASCII-armored (`-a`)
   * rather than age's default binary output so the result stays a plain
   * string, same transport as the SQL it replaces — no base64 wrapping
   * needed to carry it through the JSON request/response pattern the rest
   * of the app uses. Fails the whole backup rather than ever falling back
   * to writing plaintext: an unconfigured key must not silently produce an
   * unencrypted dump.
   */
  private async encrypt(sql: string): Promise<string> {
    const publicKey = this.configService.get<string>(
      "BACKUP_ENCRYPTION_PUBLIC_KEY",
    );

    if (!publicKey) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.AdminMisconfigured,
        undefined,
        "BACKUP_ENCRYPTION_PUBLIC_KEY is not set",
      );
    }

    return this.run("age", ["-r", publicKey, "-a"], sql);
  }

  /** Deletes every persisted dump beyond the {@link KEEP} most recent, on disk and in DB. */
  private async prune(): Promise<void> {
    const stale = await this.prisma.backupFile.findMany({
      orderBy: { createdAt: "desc" },
      skip: KEEP,
    });
    if (stale.length === 0) return;

    await Promise.all(
      stale.map((f) => rm(join(this.dir, f.filename), { force: true })),
    );
    await this.prisma.backupFile.deleteMany({
      where: { id: { in: stale.map((f) => f.id) } },
    });
  }

  /** Connection info for pg_dump/psql via the standard libpq PG* env vars — keeps the password out of argv/`ps`. */
  private pgEnv(): NodeJS.ProcessEnv {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.AdminMisconfigured,
        undefined,
        "DATABASE_URL is not set",
      );
    }

    const url = new URL(databaseUrl);
    return {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || "5432",
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: url.pathname.replace(/^\//, ""),
    };
  }

  private run(
    command: string,
    args: string[],
    stdin?: string,
  ): Promise<string> {
    const env =
      command === "pg_dump" || command === "psql" ? this.pgEnv() : process.env;

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { env });
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));

      child.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          reject(
            new AppException(
              HttpStatus.SERVICE_UNAVAILABLE,
              ErrorCode.AdminMisconfigured,
              undefined,
              `${command} is not installed on this instance`,
            ),
          );
        } else {
          reject(
            new AppException(
              HttpStatus.INTERNAL_SERVER_ERROR,
              ErrorCode.InternalError,
              undefined,
              err.message,
            ),
          );
        }
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          this.logger.error(`${command} exited with code ${code}: ${stderr}`);
          reject(
            new AppException(
              HttpStatus.INTERNAL_SERVER_ERROR,
              ErrorCode.InternalError,
              undefined,
              stderr.trim() || `${command} failed (exit ${code})`,
            ),
          );
        }
      });

      if (stdin !== undefined) {
        child.stdin.write(stdin);
        child.stdin.end();
      }
    });
  }
}

function toDto(row: {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: Date;
}): AdminBackupFileDto {
  return {
    id: row.id,
    filename: row.filename,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ["Ko", "Mo", "Go"];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value.toFixed(1)} ${units[unit]}`;
}
