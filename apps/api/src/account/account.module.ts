import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChatModule } from "../chat/chat.module";
import { JobsModule } from "../jobs/jobs.module";
import { LibraryModule } from "../library/library.module";
import { ListsModule } from "../lists/lists.module";
import { MailModule } from "../mail/mail.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { SecurityModule } from "../security/security.module";
import { AccountDeletionService } from "./account-deletion.service";
import { CsvExportService } from "./csv-export.service";
import { DataExportService } from "./data-export.service";
import { InactiveAccountService } from "./inactive-account.service";
import { MigrationExportService } from "./migration-export.service";
import { ScheduledDeletionService } from "./scheduled-deletion.service";

// An account's whole lifecycle across every module: deleting it (now, on a
// schedule, or after years of inactivity) and exporting it. It reads and
// removes rows all over the schema, so it sits at the top of the module graph
// (docs/adr/0010-module-layers.md): only users/, admin/ and public-api/ import it.
@Module({
  imports: [
    AuthModule,
    ChatModule,
    JobsModule,
    LibraryModule,
    ListsModule,
    MailModule,
    ReviewsModule,
    SecurityModule,
  ],
  providers: [
    AccountDeletionService,
    CsvExportService,
    DataExportService,
    InactiveAccountService,
    MigrationExportService,
    ScheduledDeletionService,
  ],
  exports: [
    AccountDeletionService,
    CsvExportService,
    DataExportService,
    InactiveAccountService,
    MigrationExportService,
    ScheduledDeletionService,
  ],
})
export class AccountModule {}
