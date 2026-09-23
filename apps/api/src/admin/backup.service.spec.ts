import { EventEmitter } from "node:events";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { vi, type Mock } from "vitest";
import type { JobRunService } from "../jobs/job-run.service";
import type { PrismaService } from "../prisma/prisma.service";
import { BackupService } from "./backup.service";

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

class FakeChildProcess extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  stdin = { write: vi.fn(), end: vi.fn() };
}

/** Registers the next spawn() call to succeed immediately with exit code 0. */
function mockNextSpawnSuccess(): FakeChildProcess {
  const child = new FakeChildProcess();
  spawnMock.mockImplementationOnce(() => {
    queueMicrotask(() => child.emit("close", 0));
    return child;
  });
  return child;
}

function makeService() {
  const prisma = {} as unknown as PrismaService;
  const jobRuns = {} as unknown as JobRunService;
  const configService = { get: vi.fn() } as never;
  return new BackupService(prisma, jobRuns, configService);
}

describe("BackupService.restore", () => {
  const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

  beforeEach(() => {
    spawnMock.mockReset();
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
  });

  afterEach(() => {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  });

  // The runtime image (apps/api/Dockerfile) strips every package
  // manager, pnpm included — restore() must never shell out to one, or a
  // restore succeeds at replacing the database and then fails (ENOENT)
  // before migrations are reapplied.
  it("never invokes a package manager to reapply migrations", async () => {
    mockNextSpawnSuccess(); // psql
    mockNextSpawnSuccess(); // prisma migrate deploy

    await makeService().restore("SELECT 1;");

    expect(spawnMock).toHaveBeenCalledTimes(2);
    const commandsInvoked = spawnMock.mock.calls.map((call) => call[0]);

    expect(commandsInvoked[0]).toBe("psql");
    expect(commandsInvoked[1]).not.toMatch(/^(pnpm|npm|npx|yarn|corepack)$/);
  });

  it("reapplies migrations via the local prisma binary, after psql", async () => {
    mockNextSpawnSuccess();
    mockNextSpawnSuccess();

    await makeService().restore("SELECT 1;");

    expect(spawnMock).toHaveBeenNthCalledWith(
      2,
      "node_modules/.bin/prisma",
      ["migrate", "deploy"],
      expect.anything(),
    );
  });
});

describe("BackupService file consistency", () => {
  let backupDir: string;
  const previousDir = process.env.BACKUP_DIR;
  const previousDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(async () => {
    backupDir = await mkdtemp(join(tmpdir(), "loomkeep-backup-test-"));
    process.env.BACKUP_DIR = backupDir;
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    spawnMock.mockReset();
  });

  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(backupDir, { recursive: true, force: true });
    if (previousDir === undefined) delete process.env.BACKUP_DIR;
    else process.env.BACKUP_DIR = previousDir;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  function makeBackupService() {
    const prisma = {
      backupFile: {
        create: vi.fn(),
        delete: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const jobRuns = {
      record: vi.fn((_key, action: () => Promise<unknown>) => action()),
    } as unknown as JobRunService;
    const config = {
      get: vi.fn().mockReturnValue("age1test"),
    } as never;
    return { service: new BackupService(prisma, jobRuns, config), prisma };
  }

  it("removes the encrypted file when saving its database row fails", async () => {
    const { service, prisma } = makeBackupService();
    const first = mockNextSpawnSuccess();
    const second = mockNextSpawnSuccess();
    first.stdout.write("dump");
    second.stdout.write("encrypted");
    (prisma.backupFile.create as Mock).mockRejectedValue(new Error("db down"));

    await expect(service.runScheduled()).rejects.toThrow("db down");
    expect(await readdir(backupDir)).toEqual([]);
  });

  it("restores a staged file if deleting its database row fails", async () => {
    const { service, prisma } = makeBackupService();
    const filename = "loomkeep-2026-09-23-12-00-00.sql.age";
    await writeFile(join(backupDir, filename), "encrypted");
    (prisma.backupFile.findUnique as Mock).mockResolvedValue({
      id: "backup-1",
      filename,
    });
    (prisma.backupFile.delete as Mock).mockRejectedValue(new Error("db down"));

    await expect(service.deleteFile("backup-1")).rejects.toThrow("db down");
    expect(await readFile(join(backupDir, filename), "utf8")).toBe("encrypted");
  });

  it("removes a missing-file row and reports orphaned encrypted files", async () => {
    const { service, prisma } = makeBackupService();
    const orphan = "loomkeep-2026-09-23-12-00-00.sql.age";
    await writeFile(join(backupDir, orphan), "encrypted");
    (prisma.backupFile.findMany as Mock).mockResolvedValueOnce([
      {
        id: "missing-1",
        filename: "loomkeep-2026-09-22-12-00-00.sql.age",
        sizeBytes: 10,
        createdAt: new Date("2026-09-22T12:00:00Z"),
      },
    ]);

    const inventory = await service.listFiles();

    expect(prisma.backupFile.delete).toHaveBeenCalledWith({
      where: { id: "missing-1" },
    });
    expect(inventory.files).toEqual([]);
    expect(inventory.orphans).toEqual([
      expect.objectContaining({ filename: orphan, sizeBytes: 9 }),
    ]);
  });

  it("keeps missing metadata visible when automatic cleanup fails", async () => {
    const { service, prisma } = makeBackupService();
    const row = {
      id: "missing-1",
      filename: "loomkeep-2026-09-22-12-00-00.sql.age",
      sizeBytes: 10,
      createdAt: new Date("2026-09-22T12:00:00Z"),
    };
    (prisma.backupFile.findMany as Mock).mockResolvedValueOnce([row]);
    (prisma.backupFile.delete as Mock).mockRejectedValue(new Error("db down"));

    const inventory = await service.listFiles();

    expect(inventory.files).toEqual([
      expect.objectContaining({ id: row.id, status: "MISSING" }),
    ]);
  });

  it("only deletes an unregistered orphan after an explicit request", async () => {
    const { service, prisma } = makeBackupService();
    const filename = "loomkeep-2026-09-23-12-00-00.sql.age";
    await writeFile(join(backupDir, filename), "encrypted");

    await service.listFiles();
    expect(await readdir(backupDir)).toEqual([filename]);

    (prisma.backupFile.findFirst as Mock).mockResolvedValueOnce({
      id: "registered",
    });
    await expect(service.deleteOrphanFile(filename)).rejects.toThrow();
    expect(await readdir(backupDir)).toEqual([filename]);

    await service.deleteOrphanFile(filename);
    expect(await readdir(backupDir)).toEqual([]);
  });
});
