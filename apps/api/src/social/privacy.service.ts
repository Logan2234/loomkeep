import {
  type GhostSwitchImpactDto,
  ProfileAccess,
  type UpdateVisibilitySettingsDto,
  type VisibilitySettingItemDto,
  type VisibilitySettingsDto,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SOCIAL_DOMAINS, SOCIAL_FACETS } from "./social.constants";
import { VisibilityService } from "./visibility.service";

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
  ) {}

  /** The full privacy config: profile access + every domain × facet audience. */
  async getSettings(userId: string): Promise<VisibilitySettingsDto> {
    const [user, map] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { profileAccess: true },
      }),
      this.visibility.getSettingsMap(userId),
    ]);

    const settings: VisibilitySettingItemDto[] = [];

    for (const domain of SOCIAL_DOMAINS) {
      for (const facet of SOCIAL_FACETS) {
        settings.push({
          domain,
          facet,
          audience: this.visibility.audienceFor(map, domain, facet),
        });
      }
    }

    return { profileAccess: user.profileAccess as ProfileAccess, settings };
  }

  /**
   * Live counts of what switching to Figurant would immediately clean up —
   * shown to the user in a confirmation modal before they commit to it.
   */
  async previewGhostSwitch(userId: string): Promise<GhostSwitchImpactDto> {
    const [followersToRemove, outgoingFollowsToCancel, listsToDowngrade] =
      await Promise.all([
        this.prisma.follow.count({ where: { followeeId: userId } }),
        this.prisma.follow.count({
          where: {
            followerId: userId,
            followee: { profileAccess: { not: ProfileAccess.PUBLIC } },
          },
        }),
        this.prisma.list.count({
          where: { userId, visibility: { not: "PRIVATE" } },
        }),
      ]);

    return { followersToRemove, outgoingFollowsToCancel, listsToDowngrade };
  }

  /** Applies a partial update (profile access and/or individual matrix cells). */
  async updateSettings(
    userId: string,
    dto: UpdateVisibilitySettingsDto,
  ): Promise<VisibilitySettingsDto> {
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (dto.profileAccess) {
      ops.push(
        this.prisma.user.update({
          where: { id: userId },
          data: { profileAccess: dto.profileAccess },
        }),
      );
    }

    // Applying the Figurant matrix immediately: they can't be followed, and
    // can't have shared lists — clean up what already contradicts that.
    if (dto.profileAccess === ProfileAccess.GHOST) {
      ops.push(
        this.prisma.follow.deleteMany({ where: { followeeId: userId } }),
        this.prisma.follow.deleteMany({
          where: {
            followerId: userId,
            followee: { profileAccess: { not: ProfileAccess.PUBLIC } },
          },
        }),
        this.prisma.list.updateMany({
          where: { userId, visibility: { not: "PRIVATE" } },
          data: { visibility: "PRIVATE" },
        }),
      );
    }

    for (const cell of dto.settings ?? []) {
      ops.push(
        this.prisma.visibilitySetting.upsert({
          where: {
            userId_domain_facet: {
              userId,
              domain: cell.domain,
              facet: cell.facet,
            },
          },
          update: { audience: cell.audience },
          create: {
            userId,
            domain: cell.domain,
            facet: cell.facet,
            audience: cell.audience,
          },
        }),
      );
    }

    if (ops.length > 0) await this.prisma.$transaction(ops);
    return this.getSettings(userId);
  }
}
