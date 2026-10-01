import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlements/entitlement.module";
import { MailModule } from "../mail/mail.module";
import { SecurityModule } from "../security/security.module";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";
import { ApiRateLimitGuard } from "./api-rate-limit.guard";
import { ApiRateLimitService } from "./api-rate-limit.service";

@Module({
  imports: [MailModule, SecurityModule, EntitlementModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiRateLimitService, ApiRateLimitGuard],
  exports: [ApiRateLimitService, ApiRateLimitGuard],
})
export class ApiKeysModule {}
