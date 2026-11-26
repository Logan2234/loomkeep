import { Module } from "@nestjs/common";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { JobsModule } from "../jobs/jobs.module";
import { MailModule } from "../mail/mail.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SecurityModule } from "../security/security.module";
import { ApiKeyLifecycleService } from "./api-key-lifecycle.service";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";
import { ApiRateLimitService } from "./api-rate-limit.service";
import { PublicApiGuard } from "./public-api.guard";
import { GithubPublicKeysService } from "./secret-scanning/github-public-keys.service";
import { GithubSignatureGuard } from "./secret-scanning/github-signature.guard";
import { SecretScanningController } from "./secret-scanning/secret-scanning.controller";

@Module({
  imports: [
    MailModule,
    SecurityModule,
    EntitlementsModule,
    NotificationsModule,
    JobsModule,
  ],
  controllers: [ApiKeysController, SecretScanningController],
  providers: [
    ApiKeysService,
    GithubPublicKeysService,
    GithubSignatureGuard,
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
