import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { PushModule } from "../notifications/push.module";
import { SocialModule } from "../social/social.module";
import { ChatService } from "./chat.service";

// Private messages between friends: the service alone, which account deletion
// and moderation (UsersModule, AdminModule) call too. The routes live in
// ChatApiModule, whose work cards need the catalogue modules — and those
// import UsersModule, which would make a cycle here.
@Module({
  imports: [SocialModule, EventsModule, PushModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
