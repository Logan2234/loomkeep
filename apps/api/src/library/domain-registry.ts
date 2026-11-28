import { Injectable } from "@nestjs/common";
import { BooksDomainAdapter } from "../books/books-domain.adapter";
import { GamesDomainAdapter } from "../games/games-domain.adapter";
import { MediaDomainAdapter } from "../media/media-domain.adapter";
import { MusicDomainAdapter } from "../music/music-domain.adapter";
import type { DomainAdapter, TrackedDomain } from "../work/domain-adapter";

/**
 * Every domain's adapter, keyed by domain: what the modules reading all the
 * domains at once iterate instead of naming each one's tables. A new domain
 * provides its adapter and adds one line here; TypeScript refuses the
 * registry while one is missing.
 */
@Injectable()
export class DomainRegistry {
  private readonly adapters: { [D in TrackedDomain]: DomainAdapter<D> };

  constructor(
    private readonly media: MediaDomainAdapter,
    private readonly games: GamesDomainAdapter,
    private readonly books: BooksDomainAdapter,
    private readonly music: MusicDomainAdapter,
  ) {
    this.adapters = { MEDIA: media, GAMES: games, BOOKS: books, MUSIC: music };
  }

  /** Whether the domain has tables, and so an adapter. */
  has(domain: string): domain is TrackedDomain {
    return Object.hasOwn(this.adapters, domain);
  }

  get<D extends TrackedDomain>(domain: D): DomainAdapter<D> {
    return this.adapters[domain];
  }

  all(): DomainAdapter[] {
    return Object.values(this.adapters);
  }

  /** Every domain's keys of the account export, merged. */
  async exportEntries(userId: string) {
    const [media, games, books, music] = await Promise.all([
      this.media.exportEntries(userId),
      this.games.exportEntries(userId),
      this.books.exportEntries(userId),
      this.music.exportEntries(userId),
    ]);
    return { ...media, ...games, ...books, ...music };
  }
}
