import {
  Domain,
  type DomainPileDto,
  type PileSummaryDto,
  type StatsDomain,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { BookLibraryService } from "../books/book-library.service";
import { GameLibraryService } from "../games/game-library.service";
import { LibraryService } from "../library/library.service";
import { MusicLibraryService } from "../music/music-library.service";
import { DomainGateService } from "../users/domain-gate.service";
import { filterEnabledDomains } from "./enabled-domains.util";

/**
 * The /stats "Ta pile" row: each enabled domain's pile, unfiltered. Each
 * library computes its own (the header of its list reuses the same method
 * with the list's filters), so the two figures can never disagree.
 */
@Injectable()
export class PileService {
  constructor(
    private readonly domainGate: DomainGateService,
    private readonly media: LibraryService,
    private readonly games: GameLibraryService,
    private readonly books: BookLibraryService,
    private readonly music: MusicLibraryService,
  ) {}

  async getPiles(
    userId: string,
    requested: StatsDomain | "ALL",
  ): Promise<DomainPileDto[]> {
    const domains = filterEnabledDomains(
      requested,
      await this.domainGate.getEnabledDomains(userId),
    );

    return Promise.all(
      domains.map(async (domain) => ({
        domain,
        pile: await this.pileOf(userId, domain),
      })),
    );
  }

  private pileOf(userId: string, domain: StatsDomain): Promise<PileSummaryDto> {
    switch (domain) {
      case Domain.MEDIA:
        return this.media.getPile(userId, {});
      case Domain.GAMES:
        return this.games.getPile(userId, {});
      case Domain.BOOKS:
        return this.books.getPile(userId, {});
      case Domain.MUSIC:
        return this.music.getPile(userId, {});
    }
  }
}
