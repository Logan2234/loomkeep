import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BooksModule } from "../books/books.module";
import { CatalogModule } from "../catalog/catalog.module";
import { CommentsModule } from "../comments/comments.module";
import { GamesModule } from "../games/games.module";
import { JobsModule } from "../jobs/jobs.module";
import { MailModule } from "../mail/mail.module";
import { MusicModule } from "../music/music.module";
import { ListsModule } from "../lists/list.module";
import { NotificationModule } from "../notifications/notification.module";
import { ReportsModule } from "../reports/reports.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { SecurityModule } from "../security/security.module";
import { SocialModule } from "../social/social.module";
import { UsersModule } from "../users/users.module";
import { AdminCacheController } from "./admin-cache.controller";
import { AdminEmailsController } from "./admin-emails.controller";
import { AdminImportsController } from "./admin-imports.controller";
import { AdminJobsController } from "./admin-jobs.controller";
import { AdminPushController } from "./admin-push.controller";
import { AdminReportsController } from "./admin-reports.controller";
import { AdminSecurityController } from "./admin-security.controller";
import { AdminStatsController } from "./admin-stats.controller";
import { AdminSystemController } from "./admin-system.controller";
import { AdminUsersController } from "./admin-users.controller";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";
import { AdminAccountsStatsService } from "./admin-accounts-stats.service";
import { AdminCatalogueStatsService } from "./admin-catalogue-stats.service";
import { AdminOverviewService } from "./admin-overview.service";
import { AdminSocialStatsService } from "./admin-social-stats.service";
import { AdminSystemStatsService } from "./admin-system-stats.service";
import { BackupService } from "./backup.service";

@Module({
  imports: [
    MailModule,
    NotificationModule,
    AuthModule,
    CatalogModule,
    GamesModule,
    BooksModule,
    MusicModule,
    JobsModule,
    SecurityModule,
    UsersModule,
    ReportsModule,
    CommentsModule,
    ReviewsModule,
    SocialModule,
    ListsModule,
  ],
  controllers: [
    AdminSystemController,
    AdminSecurityController,
    AdminJobsController,
    AdminUsersController,
    AdminEmailsController,
    AdminPushController,
    AdminCacheController,
    AdminImportsController,
    AdminReportsController,
    AdminStatsController,
  ],
  providers: [
    AdminService,
    AdminGuard,
    AdminOverviewService,
    AdminAccountsStatsService,
    AdminCatalogueStatsService,
    AdminSocialStatsService,
    AdminSystemStatsService,
    BackupService,
  ],
})
export class AdminModule {}
