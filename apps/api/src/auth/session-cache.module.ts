import { Global, Module } from "@nestjs/common";
import { SessionCacheService } from "./session-cache.service";

// Split out of AuthModule and made global (same pattern as PrismaModule/
// FeatureFlagsModule) so EventsGateway can check session liveness without
// importing AuthModule — that would cycle back through GamificationModule,
// which needs EventsGateway itself for AchievementService's own emit.
@Global()
@Module({
  providers: [SessionCacheService],
  exports: [SessionCacheService],
})
export class SessionCacheModule {}
