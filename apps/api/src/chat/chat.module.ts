import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { PushModule } from "../notifications/push.module";
import { ReportsModule } from "../reports/reports.module";
import { SocialModule } from "../social/social.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

// Private messages between friends, behind ChatFeatureGuard (social and chat
// both on). ReportsModule files reports against a message.
@Module({
  imports: [SocialModule, EventsModule, PushModule, ReportsModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
