import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { AchievementService } from "./achievements/achievement.service";
import { AchievementsController } from "./achievements/achievements.controller";
import { GamificationController } from "./gamification.controller";
import { XpService } from "./xp.service";

// G1: XP ledger + level curve. G2 adds the achievement engine (registry in
// achievements/registry.ts) and its /achievements endpoints. Still no
// leaderboard endpoint yet — that is [G7]. GET /gamification/me serves the
// viewer their own XP without going through the social profile, so levels
// keep working on a SOCIAL_ENABLED=false instance ("solo first").
@Module({
  imports: [JobsModule],
  controllers: [AchievementsController, GamificationController],
  providers: [XpService, AchievementService],
  exports: [XpService, AchievementService],
})
export class GamificationModule {}
