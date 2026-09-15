import { Module } from "@nestjs/common";
import { EventsGateway } from "./events.gateway";

// PrismaService/ConfigService/FeatureFlagsService come from their global
// modules; JwtService comes from AuthModule's JwtModule.register({ global:
// true }). No module import needed for any of them, which keeps this module
// free to be imported one-directionally by every domain that emits
// (notifications, reports, gamification, comments, lists, import) without
// risking a cycle back into this one — see EventsGateway's own class comment.
@Module({
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
