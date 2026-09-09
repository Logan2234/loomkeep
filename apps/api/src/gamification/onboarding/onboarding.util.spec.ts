import { vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import { computeOnboardingDoneMap } from "./onboarding.util";

function makePrisma(overrides: Record<string, unknown> = {}): PrismaService {
  const notFound = { findFirst: vi.fn().mockResolvedValue(null) };
  return {
    libraryEntry: { ...notFound },
    gameEntry: { ...notFound },
    bookEntry: { ...notFound },
    musicEntry: { ...notFound },
    review: { ...notFound },
    user: {
      findUnique: vi.fn().mockResolvedValue({ avatar: null, bio: null }),
    },
    importRun: { ...notFound },
    list: { ...notFound },
    comment: { ...notFound },
    ...overrides,
  } as unknown as PrismaService;
}

describe("computeOnboardingDoneMap", () => {
  it("is entirely false with no data at all", async () => {
    const prisma = makePrisma();

    await expect(computeOnboardingDoneMap(prisma, "user-1")).resolves.toEqual({
      add_title: false,
      mark_complete: false,
      rate: false,
      complete_profile: false,
      import: false,
      create_list: false,
      comment: false,
    });
  });

  it("add_title is done from any single domain, not just media", async () => {
    const prisma = makePrisma({
      bookEntry: { findFirst: vi.fn().mockResolvedValue({ id: "b1" }) },
    });

    const result = await computeOnboardingDoneMap(prisma, "user-1");
    expect(result.add_title).toBe(true);
  });

  it("complete_profile requires both an avatar and a non-empty bio", async () => {
    const prisma = makePrisma({
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ avatar: Buffer.from("x"), bio: "  " }),
      },
    });

    const result = await computeOnboardingDoneMap(prisma, "user-1");
    expect(result.complete_profile).toBe(false);
  });

  it("comment excludes soft-deleted comments (queried with deletedAt: null)", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = makePrisma({ comment: { findFirst } });

    await computeOnboardingDoneMap(prisma, "user-1");

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId: "user-1", deletedAt: null },
      }),
    );
  });

  it("import reuses fresh_start's own definition of done: a SUCCESS ImportRun", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = makePrisma({ importRun: { findFirst } });

    await computeOnboardingDoneMap(prisma, "user-1");

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", status: "SUCCESS" },
      }),
    );
  });
});
