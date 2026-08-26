import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlements/entitlement.module";
import { JobsModule } from "../jobs/jobs.module";
import { MailModule } from "../mail/mail.module";
import { NotificationDigestService } from "./notification-digest.service";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { PushService } from "./push.service";

// PrismaService comes from the global PrismaModule.
@Module({
  imports: [MailModule, JobsModule, EntitlementModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationDigestService, PushService],
  exports: [PushService, NotificationService],
})
export class NotificationModule {}
