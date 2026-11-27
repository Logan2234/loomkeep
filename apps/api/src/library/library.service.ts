import type { LibraryDomainCountsDto } from "@loomkeep/shared/contracts";
import type { Domain } from "@loomkeep/shared/enums";
import { Injectable } from "@nestjs/common";
import { DomainRegistry } from "./domain-registry";

/**
 * The library across domains: what reads every domain's entries at once.
 * Each domain's own library (entries, progress) lives in its module.
 */
@Injectable()
export class LibraryService {
  constructor(private readonly registry: DomainRegistry) {}

  /**
   * Tracked-item count per domain, hidden domains included. Deliberately not
   * routed through the stats endpoints: those are scoped to the user's
   * `enabledDomains`, and the settings tiles need to say what switching a
   * domain *off* would hide. PODCASTS/BOARDGAMES have no table yet, so they
   * are absent rather than zero.
   */
  async getDomainCounts(userId: string): Promise<LibraryDomainCountsDto> {
    const counts = await Promise.all(
      this.registry
        .all()
        .map(async (adapter): Promise<[Domain, number]> => [
          adapter.domain,
          await adapter.countEntries(userId),
        ]),
    );
    return Object.fromEntries(counts);
  }
}
