import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { AchievementService } from "./achievements/achievement.service";
import { AchievementsController } from "./achievements/achievements.controller";
import { XpService } from "./xp.service";

// G1: XP ledger + level curve. G2 adds the achievement engine (registry in
// achievements/registry.ts) and its /achievements endpoints. Still no
// leaderboard/profile endpoints — later tickets ([G7]+).
@Module({
  imports: [JobsModule],
  controllers: [AchievementsController],
  providers: [XpService, AchievementService],
  exports: [XpService, AchievementService],
})
export class GamificationModule {}
