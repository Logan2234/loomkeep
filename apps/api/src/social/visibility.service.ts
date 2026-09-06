import type {
  Domain,
  ProfileAccess,
  RelationshipDto,
  VisibilityAudience,
  VisibilityFacet,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BlockService } from "./block.service";
import {
  computeIsFriend,
  DEFAULT_FACET_AUDIENCE,
  type ViewerRelation,
} from "./visibility.util";

const NO_RELATION = (
  blocking: boolean,
  blockedByTarget: boolean,
): ViewerRelation => ({
  isSelf: false,
  following: false,
  requested: false,
  followsYou: false,
  isFriend: false,
  blocking,
  blockedByTarget,
});

/**
 * Central authority for cross-user reads (the first such path in the app).
 * Every social read of another user's data must resolve visibility through
 * this service — see visibility.util.ts for the pure rules.
 */
@Injectable()
export class VisibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlockService,
  ) {}

  /** Resolves the viewer's relationship to a target. */
  async getRelation(
    viewerId: string,
    target: { id: string; profileAccess: ProfileAccess },
  ): Promise<ViewerRelation> {
    if (viewerId === target.id) {
      return {
        isSelf: true,
        following: false,
        requested: false,
        followsYou: false,
        isFriend: true,
        blocking: false,
        blockedByTarget: false,
      };
    }

    const [outgoing, incoming, blocks] = await Promise.all([
      this.prisma.follow.findUnique({
        where: {
          followerId_followeeId: {
            followerId: viewerId,
            followeeId: target.id,
          },
        },
      }),
      this.prisma.follow.findUnique({
        where: {
          followerId_followeeId: {
            followerId: target.id,
            followeeId: viewerId,
          },
        },
      }),
      this.blocks.findBlocksBetween(viewerId, target.id),
    ]);

    const blocking = blocks.some((b) => b.blockerId === viewerId);
    const blockedByTarget = blocks.some((b) => b.blockerId === target.id);
    // A block in either direction collapses the relationship to nothing.
    if (blocking || blockedByTarget)
      return NO_RELATION(blocking, blockedByTarget);

    const following = outgoing?.status === "ACCEPTED";
    const requested = outgoing?.status === "PENDING";
    const followsYou = incoming?.status === "ACCEPTED";

    return {
      isSelf: false,
      following,
      requested,
      followsYou,
      isFriend: computeIsFriend(target.profileAccess, following, followsYou),
      blocking,
      blockedByTarget,
    };
  }

  /** Public projection of a relationship (drops the internal block-by flag). */
  toRelationshipDto(relation: ViewerRelation): RelationshipDto {
    return {
      isSelf: relation.isSelf,
      following: relation.following,
      requested: relation.requested,
      followsYou: relation.followsYou,
      isFriend: relation.isFriend,
      blocking: relation.blocking,
    };
  }

  /** Loads a user's stored visibility settings, keyed `${domain}:${facet}`. */
  async getSettingsMap(
    userId: string,
  ): Promise<Map<string, VisibilityAudience>> {
    const rows = await this.prisma.visibilitySetting.findMany({
      where: { userId },
    });
    const map = new Map<string, VisibilityAudience>();

    for (const row of rows) {
      map.set(`${row.domain}:${row.facet}`, row.audience as VisibilityAudience);
    }

    return map;
  }

  /** The audience set for a facet, or the coded default when unset. */
  audienceFor(
    settings: Map<string, VisibilityAudience>,
    domain: Domain,
    facet: VisibilityFacet,
  ): VisibilityAudience {
    return settings.get(`${domain}:${facet}`) ?? DEFAULT_FACET_AUDIENCE;
  }
}
