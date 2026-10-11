import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { ListsModule } from "../lists/list.module";
import { PushModule } from "../notifications/push.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { SocialModule } from "../social/social.module";
import { ChatService } from "./chat.service";

// Private messages between friends: the service alone, which account deletion
// and moderation (UsersModule, AdminModule) call too. The routes live in
// ChatApiModule, whose work cards need the catalogue modules — and those
// import UsersModule, which would make a cycle here. Reviews and lists draw
// the cards `/review` and `/list` attach.
@Module({
  imports: [SocialModule, EventsModule, PushModule, ReviewsModule, ListsModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
