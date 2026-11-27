import type { LibraryDomainCountsDto } from "@loomkeep/shared/contracts";
import { Domain } from "@loomkeep/shared/enums";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * The library across domains: what reads every domain's entries at once.
 * Each domain's own library (entries, progress) lives in its module.
 */
@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tracked-item count per domain, hidden domains included. Deliberately not
   * routed through the stats endpoints: those are scoped to the user's
   * `enabledDomains`, and the settings tiles need to say what switching a
   * domain *off* would hide. PODCASTS/BOARDGAMES have no table yet, so they
   * are absent rather than zero.
   */
  async getDomainCounts(userId: string): Promise<LibraryDomainCountsDto> {
    const [media, games, books, music] = await Promise.all([
      this.prisma.mediaEntry.count({ where: { userId } }),
      this.prisma.gameEntry.count({ where: { userId } }),
      this.prisma.bookEntry.count({ where: { userId } }),
      this.prisma.musicEntry.count({ where: { userId } }),
    ]);

    return {
      [Domain.MEDIA]: media,
      [Domain.GAMES]: games,
      [Domain.BOOKS]: books,
      [Domain.MUSIC]: music,
    };
  }
}
