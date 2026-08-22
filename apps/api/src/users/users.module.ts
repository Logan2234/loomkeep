import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlements/entitlement.module";
import { ListsModule } from "../lists/list.module";
import { MailModule } from "../mail/mail.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { SecurityModule } from "../security/security.module";
import { AgeGateService } from "./age-gate.service";
import { CsvExportService } from "./csv-export.service";
import { DataExportService } from "./data-export.service";
import { DomainGateService } from "./domain-gate.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [
    MailModule,
    SecurityModule,
    ReviewsModule,
    ListsModule,
    EntitlementModule,
  ],
  controllers: [UsersController],
  providers: [
    AgeGateService,
    DomainGateService,
    DataExportService,
    CsvExportService,
  ],
  exports: [
    AgeGateService,
    DomainGateService,
    DataExportService,
    CsvExportService,
    EntitlementModule,
  ],
})
export class UsersModule {}
