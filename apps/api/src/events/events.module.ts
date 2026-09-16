import { Module } from "@nestjs/common";
import { MetricsModule } from "../metrics/metrics.module";
import { EventsGateway } from "./events.gateway";

// PrismaService/ConfigService/FeatureFlagsService come from their global
// modules; JwtService comes from AuthModule's JwtModule.register({ global:
// true }). MetricsModule is the one real import here — it's a leaf module
// (no dependency of its own back on this one), so it can't reintroduce the
// cycle this module otherwise stays free of, which keeps this module free to
// be imported one-directionally by every domain that emits (notifications,
// reports, gamification, comments, lists, import) without risking a cycle
// back into this one — see EventsGateway's own class comment.
@Module({
  imports: [MetricsModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
