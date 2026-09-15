import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { GamificationModule } from "../gamification/gamification.module";
import { NotificationModule } from "../notifications/notification.module";
import { ReportsModule } from "../reports/reports.module";
import { SocialModule } from "../social/social.module";
import { CommentController } from "./comment.controller";
import { CommentService } from "./comment.service";

// P4 comments. Imports SocialModule for VisibilityService (block filtering),
// NotificationModule for reply/mention/reaction-threshold notifications, and
// ReportsModule so the controller can file a report against a comment.
@Module({
  imports: [
    SocialModule,
    NotificationModule,
    ReportsModule,
    GamificationModule,
    EventsModule,
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentsModule {}
