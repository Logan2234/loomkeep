import {
  ErrorCode,
  type AdminBackupFileContentDto,
  type AdminBackupFileDto,
  type AdminBackupInventoryDto,
  type AdminOrphanBackupFileDto,
} from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { AppException } from "../common/app.exception";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { PrismaService } from "../prisma/prisma.service";

/** How many dumps are kept on disk — older ones are purged after each run. */
const KEEP = 7;
const DUMP_ARGS = ["--no-owner", "--no-privileges", "--clean", "--if-exists"];
const BACKUP_FILENAME =
  /^loomkeep-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}(?:-[a-f0-9]{8})?\.sql\.age(?:\.deleting-[a-f0-9-]{36})?$/;

/**
 * Shells out to pg_dump/psql rather than reimplementing a dump in Prisma: it's
 * the only way to get a faithfully-restorable snapshot (every table, type,
 * constraint) without hand-maintaining an exporter that tracks every future
 * migration. Plain-SQL rather than pg_dump's binary format, so a dump travels
 * as a string through the same JSON pattern as the rest of the app.
 * The nightly dump itself never goes through the API's memory: pg_dump is
 * piped through age straight to disk ({@link dumpEncryptedTo}).
 *
 * Dumps go to BACKUP_DIR — a Docker volume separate from the Postgres data
 * volume it backs up, so a corrupt DB doesn't take its own backups with it.
 *
 * Each one is encrypted (age, ASCII-armored) for BACKUP_ENCRYPTION_PUBLIC_KEY
 * before it ever touches disk: a plain dump is the whole user database
 * (emails, password hashes, birth dates, watch history) in the clear. Only the
 * public key lives here, so nothing on this instance can decrypt a dump back —
 * restoring means the operator decrypts it themselves (`age -d`) with a private
 * key that never touches this server, then uploads the SQL to {@link restore}.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private fileOperation: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobRuns: JobRunService,
    private readonly configService: ConfigService,
  ) {}

  private get dir(): string {
    return process.env.BACKUP_DIR ?? join(process.cwd(), "backups");
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
    // Same local binary the Dockerfile's own CMD calls directly (dist/src's
    // sibling node_modules/.bin) — the runtime image deliberately strips
    // every package manager (pnpm included, see apps/api/Dockerfile), so
    // `pnpm exec` would ENOENT here in production, after psql already
    // replaced the database.
    await this.run("node_modules/.bin/prisma", ["migrate", "deploy"]);
  }

  /** Daily 3h dump to disk, pruned to the {@link KEEP} most recent. Also the manual "Sauvegarder maintenant" trigger. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: JOB_KEYS.BACKUP })
  async runScheduled(): Promise<AdminBackupFileDto> {
    return this.jobRuns.record(
      JOB_KEYS.BACKUP,
      async () => {
        const filename = `loomkeep-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}-${randomUUID().slice(0, 8)}.sql.age`;
        // Outside the file lock (a dump takes a while) and under a name
        // BACKUP_FILENAME doesn't match, so the inventory never lists a
        // half-written file as an orphan.
        const partial = `${filename}.partial`;
        await mkdir(this.dir, { recursive: true });
        await this.dumpEncryptedTo(join(this.dir, partial));
        return this.withFileLock(() => this.writeBackup(partial, filename));
      },
      (file) => `${file.filename} (${formatBytes(file.sizeBytes)})`,
    );
  }

  async listFiles(): Promise<AdminBackupInventoryDto> {
    return this.withFileLock(() => this.reconcileFiles());
  }

  private async reconcileFiles(): Promise<AdminBackupInventoryDto> {
    await mkdir(this.dir, { recursive: true });
    const rows = await this.prisma.backupFile.findMany({
      orderBy: { createdAt: "desc" },
    });
    const entries = await readdir(this.dir, { withFileTypes: true });
    const names = new Set(
      entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
    );
    const files: AdminBackupFileDto[] = [];

    for (const row of rows) {
      if (names.has(row.filename)) {
        files.push(toDto(row));
        continue;
      }

      const stagedName = [...names].find((name) =>
        name.startsWith(`${row.filename}.deleting-`),
      );

      if (stagedName) {
        try {
          await rename(
            join(this.dir, stagedName),
            join(this.dir, row.filename),
          );
          names.delete(stagedName);
          names.add(row.filename);
          files.push(toDto(row));
          continue;
        } catch (error) {
          this.logger.error(
            `Could not restore staged backup ${stagedName}`,
            error,
          );
        }
      } else {
        try {
          await this.prisma.backupFile.delete({ where: { id: row.id } });
          continue;
        } catch (error) {
          this.logger.error(
            `Could not remove missing backup metadata ${row.id}`,
            error,
          );
        }
      }

      files.push({ ...toDto(row), status: "MISSING" });
    }

    const registeredNames = new Set(files.map((file) => file.filename));
    const orphans: AdminOrphanBackupFileDto[] = [];

    for (const name of names) {
      const originalName = name.replace(/\.deleting-[a-f0-9-]{36}$/, "");
      if (!BACKUP_FILENAME.test(name) || registeredNames.has(originalName))
        continue;
      const details = await stat(join(this.dir, name));
      orphans.push({
        filename: name,
        sizeBytes: details.size,
        createdAt: details.mtime.toISOString(),
      });
    }

    return { files, orphans };
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
    await this.withFileLock(async () => {
      const row = await this.prisma.backupFile.findUnique({ where: { id } });
      if (!row)
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.AdminBackupNotFound,
        );
      await this.deleteStoredFile(row);
    });
  }

  async deleteOrphanFile(filename: string): Promise<void> {
    await this.withFileLock(async () => {
      if (!BACKUP_FILENAME.test(filename)) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.AdminBackupNotFound,
        );
      }

      const registered = await this.prisma.backupFile.findFirst({
        where: { filename: filename.replace(/\.deleting-[a-f0-9-]{36}$/, "") },
      });

      if (registered) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.AdminBackupNotOrphan,
        );
      }

      const entries = await readdir(this.dir, { withFileTypes: true });

      const orphan = entries.find(
        (entry) => entry.name === filename && entry.isFile(),
      );

      if (!orphan) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.AdminBackupNotFound,
        );
      }

      await rm(join(this.dir, orphan.name));
    });
  }

  private async writeBackup(
    partial: string,
    filename: string,
  ): Promise<AdminBackupFileDto> {
    try {
      await rename(join(this.dir, partial), join(this.dir, filename));
    } catch (error) {
      await rm(join(this.dir, partial), { force: true });
      throw error;
    }

    let row;

    try {
      const { size } = await stat(join(this.dir, filename));
      row = await this.prisma.backupFile.create({
        data: { filename, sizeBytes: size },
      });
    } catch (error) {
      try {
        await rm(join(this.dir, filename));
      } catch (cleanupError) {
        this.logger.error(
          `Could not remove unregistered backup ${filename}`,
          cleanupError,
        );
      }

      throw error;
    }

    await this.prune();
    await this.reconcileFiles();
    return toDto(row);
  }

  /**
   * Streams pg_dump through age, encrypting for BACKUP_ENCRYPTION_PUBLIC_KEY,
   * straight into `path`: the dump (the whole user database) never sits in
   * the API's memory, in clear or encrypted. ASCII-armored (`-a`) rather than
   * age's default binary output so the file stays a plain string, carried
   * through the JSON download like the rest of the app. Fails the whole
   * backup rather than ever falling back to writing plaintext: an
   * unconfigured key must not silently produce an unencrypted dump. Either
   * process failing removes the partial file.
   */
  private async dumpEncryptedTo(path: string): Promise<void> {
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

    // Opened before either process starts, so the cleanup below can't race
    // a still-pending open into leaving the partial file behind.
    const out = (await open(path, "wx")).createWriteStream();
    const dump = this.spawnTool("pg_dump", DUMP_ARGS);
    const age = this.spawnTool("age", ["-r", publicKey, "-a"]);

    try {
      await Promise.all([
        pipeline(dump.child.stdout, age.child.stdin),
        pipeline(age.child.stdout, out),
        dump.exited,
        age.exited,
      ]);
    } catch (error) {
      dump.child.kill();
      age.child.kill();
      out.destroy();
      await rm(path, { force: true });
      throw error;
    }
  }

  /** Deletes every persisted dump beyond the {@link KEEP} most recent, on disk and in DB. */
  private async prune(): Promise<void> {
    const stale = await this.prisma.backupFile.findMany({
      orderBy: { createdAt: "desc" },
      skip: KEEP,
    });
    if (stale.length === 0) return;

    for (const file of stale) await this.deleteStoredFile(file);
  }

  private async deleteStoredFile(row: {
    id: string;
    filename: string;
  }): Promise<void> {
    const original = join(this.dir, row.filename);
    const staged = `${original}.deleting-${randomUUID()}`;
    let moved = false;

    try {
      await rename(original, staged);
      moved = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    try {
      await this.prisma.backupFile.delete({ where: { id: row.id } });
    } catch (error) {
      if (moved) await rename(staged, original);
      throw error;
    }

    if (moved) await rm(staged);
  }

  private async withFileLock<T>(action: () => Promise<T>): Promise<T> {
    const previous = this.fileOperation;
    let release!: () => void;
    this.fileOperation = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      return await action();
    } finally {
      release();
    }
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

  /** Spawns a CLI tool; `exited` settles once it exits, rejecting on a failure or a non-zero code. */
  private spawnTool(
    command: string,
    args: string[],
  ): { child: ChildProcessWithoutNullStreams; exited: Promise<void> } {
    const env =
      command === "pg_dump" || command === "psql" ? this.pgEnv() : process.env;
    const child = spawn(command, args, { env });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));

    const exited = new Promise<void>((resolve, reject) => {
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
          resolve();
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
    });

    return { child, exited };
  }

  private async run(
    command: string,
    args: string[],
    stdin?: string,
  ): Promise<void> {
    const { child, exited } = this.spawnTool(command, args);
    // Drained, never kept: a full stdout pipe would stall psql mid-restore.
    child.stdout.resume();

    if (stdin !== undefined) {
      child.stdin.write(stdin);
      child.stdin.end();
    }

    await exited;
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
    status: "AVAILABLE",
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
