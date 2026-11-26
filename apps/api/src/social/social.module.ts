import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { GamificationModule } from "../gamification/gamification.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ReportsModule } from "../reports/reports.module";
import { UserGatesModule } from "../users/user-gates.module";
import { ActivityService } from "./activity.service";
import { BlockService } from "./block.service";
import { FollowService } from "./follow.service";
import { LeaderboardController } from "./leaderboard/leaderboard.controller";
import { LeaderboardService } from "./leaderboard/leaderboard.service";
import { PrivacyController } from "./privacy.controller";
import { PrivacyService } from "./privacy.service";
import { ProfileService } from "./profile.service";
import { SocialController } from "./social.controller";
import { VisibilityService } from "./visibility.service";
import { WorkFriendsService } from "./work-friends.service";

// Social routes are gated behind SOCIAL_ENABLED through SocialFeatureGuard.
// The leaderboard lives here rather than in GamificationModule: it's inherently
// social-gated and leans on FollowService for the friends scope — putting it
// in Gamification would need Gamification to import Social, which already
// imports Gamification (AchievementService), a real circular dependency.
@Module({
  imports: [
    NotificationsModule,
    GamificationModule,
    EventsModule,
    UserGatesModule,
    ReportsModule,
  ],
  controllers: [SocialController, PrivacyController, LeaderboardController],
  providers: [
    BlockService,
    VisibilityService,
    FollowService,
    ProfileService,
    PrivacyService,
    ActivityService,
    LeaderboardService,
    WorkFriendsService,
  ],
  exports: [
    BlockService,
    VisibilityService,
    ActivityService,
    FollowService,
    ProfileService,
    WorkFriendsService,
  ],
})
export class SocialModule {}
