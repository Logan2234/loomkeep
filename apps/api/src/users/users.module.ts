import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EntitlementModule } from "../entitlements/entitlement.module";
import { EventsModule } from "../events/events.module";
import { GamificationModule } from "../gamification/gamification.module";
import { JobsModule } from "../jobs/jobs.module";
import { ListsModule } from "../lists/list.module";
import { MailModule } from "../mail/mail.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { SecurityModule } from "../security/security.module";
import { SocialModule } from "../social/social.module";
import { AccountDeletionService } from "./account-deletion.service";
import { AgeGateService } from "./age-gate.service";
import { CsvExportService } from "./csv-export.service";
import { DataExportService } from "./data-export.service";
import { DomainGateModule } from "./domain-gate.module";
import { InactiveAccountService } from "./inactive-account.service";
import { MfaController } from "./mfa.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [
    AuthModule,
    MailModule,
    SecurityModule,
    ReviewsModule,
    ListsModule,
    EntitlementModule,
    DomainGateModule,
    JobsModule,
    SocialModule,
    GamificationModule,
    EventsModule,
  ],
  controllers: [UsersController, MfaController],
  providers: [
    AgeGateService,
    DataExportService,
    CsvExportService,
    AccountDeletionService,
    InactiveAccountService,
    UsersService,
  ],
  exports: [
    AgeGateService,
    DomainGateModule,
    DataExportService,
    CsvExportService,
    AccountDeletionService,
    EntitlementModule,
  ],
})
export class UsersModule {}
