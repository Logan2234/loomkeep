import { BooksDomainAdapter } from "../books/books-domain.adapter";
import { GamesDomainAdapter } from "../games/games-domain.adapter";
import { DomainRegistry } from "../library/domain-registry";
import { MediaDomainAdapter } from "../media/media-domain.adapter";
import { MusicDomainAdapter } from "../music/music-domain.adapter";
import type { PrismaService } from "../prisma/prisma.service";
import type { ReviewService } from "../reviews/review.service";

/** The real registry and adapters, over a Prisma (often mocked) of the test's. */
export function domainRegistry(
  prisma: PrismaService,
  reviews: ReviewService = {
    getRatings: () => Promise.resolve(new Map()),
  } as unknown as ReviewService,
): DomainRegistry {
  return new DomainRegistry(
    new MediaDomainAdapter(prisma, reviews),
    new GamesDomainAdapter(prisma, reviews),
    new BooksDomainAdapter(prisma, reviews),
    new MusicDomainAdapter(prisma, reviews),
  );
}
