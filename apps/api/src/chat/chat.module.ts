import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { ListsModule } from "../lists/lists.module";
import { PushModule } from "../notifications/push.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { SocialModule } from "../social/social.module";
import { ChatService } from "./chat.service";

// Private messages between friends: the service alone, which account deletion
// and moderation (AccountModule, AdminModule) call too. The routes live in
// ChatApiModule, whose work cards need the catalogue modules: kept apart, this
// module stays in the community layer (docs/adr/0010-module-layers.md) while
// ChatApiModule sits at the top. Reviews and lists draw the cards `/review`
// and `/list` attach.
@Module({
  imports: [SocialModule, EventsModule, PushModule, ReviewsModule, ListsModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
