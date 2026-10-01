import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlements/entitlement.module";
import { JobsModule } from "../jobs/jobs.module";
import { MailModule } from "../mail/mail.module";
import { NotificationModule } from "../notifications/notification.module";
import { SecurityModule } from "../security/security.module";
import { ApiKeyLifecycleService } from "./api-key-lifecycle.service";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";
import { ApiRateLimitService } from "./api-rate-limit.service";
import { PublicApiGuard } from "./public-api.guard";

@Module({
  imports: [
    MailModule,
    SecurityModule,
    EntitlementModule,
    NotificationModule,
    JobsModule,
  ],
  controllers: [ApiKeysController],
  providers: [
    ApiKeysService,
    ApiKeyLifecycleService,
    ApiRateLimitService,
    PublicApiGuard,
  ],
  exports: [
    ApiKeysService,
    ApiKeyLifecycleService,
    ApiRateLimitService,
    PublicApiGuard,
  ],
})
export class ApiKeysModule {}
