import { Module } from "@nestjs/common";
import { ChatModule } from "../chat/chat.module";
import { CommentsModule } from "../comments/comments.module";
import { GamesModule } from "../games/games.module";
import { LibraryModule } from "../library/library.module";
import { NotificationModule } from "../notifications/notification.module";
import { SocialModule } from "../social/social.module";
import { NotificationActionController } from "./notification-action.controller";
import { NotificationActionService } from "./notification-action.service";

// A module of its own: Chat, Comments and Social import NotificationModule,
// which can't import them back.
@Module({
  imports: [
    ChatModule,
    CommentsModule,
    GamesModule,
    LibraryModule,
    NotificationModule,
    SocialModule,
  ],
  controllers: [NotificationActionController],
  providers: [NotificationActionService],
})
export class NotificationActionsModule {}
