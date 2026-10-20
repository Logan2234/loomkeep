import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlements/entitlement.module";
import { EventsModule } from "../events/events.module";
import { JobsModule } from "../jobs/jobs.module";
import { MailModule } from "../mail/mail.module";
import { NotificationDigestService } from "./notification-digest.service";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { PushModule } from "./push.module";

// PrismaService comes from the global PrismaModule.
@Module({
  imports: [
    MailModule,
    JobsModule,
    EntitlementModule,
    EventsModule,
    PushModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationDigestService],
  exports: [PushModule, NotificationService, NotificationDigestService],
})
export class NotificationModule {}
