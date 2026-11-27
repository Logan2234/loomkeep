import type { PrismaService } from "../prisma/prisma.service";
import { LibraryService } from "./library.service";

describe("LibraryService.getDomainCounts", () => {
  it("counts every domain's table for the caller, hidden domains included", async () => {
    const prisma = {
      mediaEntry: { count: vi.fn().mockResolvedValue(412) },
      gameEntry: { count: vi.fn().mockResolvedValue(0) },
      bookEntry: { count: vi.fn().mockResolvedValue(340) },
      musicEntry: { count: vi.fn().mockResolvedValue(7) },
    } as unknown as PrismaService;
    const service = new LibraryService(prisma);

    const counts = await service.getDomainCounts("u1");

    // GAMES stays present at 0: the settings tile needs "you track none"
    // told apart from "we don't know yet".
    expect(counts).toEqual({ MEDIA: 412, GAMES: 0, BOOKS: 340, MUSIC: 7 });

    for (const table of [
      prisma.mediaEntry,
      prisma.gameEntry,
      prisma.bookEntry,
      prisma.musicEntry,
    ]) {
      // Scoped to the user, and to nothing else — no enabledDomains filter,
      // which is the whole reason this doesn't go through /stats.
      expect(table.count).toHaveBeenCalledWith({ where: { userId: "u1" } });
    }
  });
});
