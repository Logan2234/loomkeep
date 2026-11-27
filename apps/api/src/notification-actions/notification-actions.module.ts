import { Module } from "@nestjs/common";
import { ChatModule } from "../chat/chat.module";
import { CommentsModule } from "../comments/comments.module";
import { GamesModule } from "../games/games.module";
import { MediaModule } from "../media/media.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SocialModule } from "../social/social.module";
import { NotificationActionController } from "./notification-action.controller";
import { NotificationActionService } from "./notification-action.service";

// A module of its own: Chat, Comments and Social import NotificationsModule,
// which can't import them back.
@Module({
  imports: [
    ChatModule,
    CommentsModule,
    GamesModule,
    MediaModule,
    NotificationsModule,
    SocialModule,
  ],
  controllers: [NotificationActionController],
  providers: [NotificationActionService],
})
export class NotificationActionsModule {}
