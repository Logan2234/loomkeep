import type { ApiV1AchievementDto, ApiV1ProfileDto } from "@loomkeep/shared";
import { levelProgress } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { AchievementService } from "../../gamification/achievements/achievement.service";
import { XpService } from "../../gamification/xp.service";
import { PrismaService } from "../../prisma/prisma.service";
import { avatarUrl } from "../../users/avatar.util";

@Injectable()
export class ProfileV1Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
    private readonly achievementService: AchievementService,
  ) {}

  async get(userId: string): Promise<ApiV1ProfileDto> {
    const [user, xp] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          bio: true,
          avatarUpdatedAt: true,
          createdAt: true,
        },
      }),
      // Null when gamification is off on this instance.
      this.xp.myXp(userId),
    ]);
    const avatar = avatarUrl(user);

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: avatar && `/api${avatar}`,
      memberSince: user.createdAt.toISOString(),
      progression: xp === null ? null : { xp, ...levelProgress(xp) },
    };
  }

  async achievements(userId: string): Promise<ApiV1AchievementDto[]> {
    const achievements = await this.achievementService.list(userId);
    return achievements.map((a) => ({
      key: a.key,
      family: a.family,
      tier: a.tier,
      unlocked: a.unlocked,
      unlockedAt: a.unlockedAt,
      progress: a.progress,
    }));
  }
}
