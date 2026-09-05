import { Module } from "@nestjs/common";
import { GamificationModule } from "../gamification/gamification.module";
import { NotificationModule } from "../notifications/notification.module";
import { ActivityService } from "./activity.service";
import { FollowService } from "./follow.service";
import { LeaderboardController } from "./leaderboard/leaderboard.controller";
import { LeaderboardService } from "./leaderboard/leaderboard.service";
import { PrivacyController } from "./privacy.controller";
import { PrivacyService } from "./privacy.service";
import { ProfileService } from "./profile.service";
import { SocialController } from "./social.controller";
import { VisibilityService } from "./visibility.service";

// P4 social graph, profiles, search and privacy. Every route is gated behind
// SOCIAL_ENABLED via SocialFeatureGuard on the controllers. The [G7]
// leaderboard lives here rather than in GamificationModule: it's inherently
// social-gated and leans on FollowService for the friends scope — putting it
// in Gamification would need Gamification to import Social, which already
// imports Gamification (AchievementService), a real circular dependency.
@Module({
  imports: [NotificationModule, GamificationModule],
  controllers: [SocialController, PrivacyController, LeaderboardController],
  providers: [
    VisibilityService,
    FollowService,
    ProfileService,
    PrivacyService,
    ActivityService,
    LeaderboardService,
  ],
  exports: [VisibilityService, ActivityService, FollowService, ProfileService],
})
export class SocialModule {}
