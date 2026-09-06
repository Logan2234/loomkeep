import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { vi } from "vitest";
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

  // LK-S04: the runtime image (apps/api/Dockerfile) strips every package
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
