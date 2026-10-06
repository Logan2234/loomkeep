import { Module } from "@nestjs/common";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { AuthModule } from "../auth/auth.module";
import { BooksModule } from "../books/books.module";
import { CatalogModule } from "../catalog/catalog.module";
import { ChatModule } from "../chat/chat.module";
import { CommentsModule } from "../comments/comments.module";
import { GamesModule } from "../games/games.module";
import { GamificationModule } from "../gamification/gamification.module";
import { ImportModule } from "../import/import.module";
import { JobsModule } from "../jobs/jobs.module";
import { ListsModule } from "../lists/list.module";
import { MailModule } from "../mail/mail.module";
import { MusicModule } from "../music/music.module";
import { AdminAlertModule } from "../notifications/admin-alert.module";
import { NotificationModule } from "../notifications/notification.module";
import { ReportsModule } from "../reports/reports.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { SecurityModule } from "../security/security.module";
import { SocialModule } from "../social/social.module";
import { UsersModule } from "../users/users.module";
import { AdminAccountsStatsService } from "./admin-accounts-stats.service";
import { AdminCacheController } from "./admin-cache.controller";
import { AdminCatalogueStatsService } from "./admin-catalogue-stats.service";
import { AdminEmailsController } from "./admin-emails.controller";
import { AdminImportsController } from "./admin-imports.controller";
import { AdminInstanceSettingsController } from "./admin-instance-settings.controller";
import { AdminInvitationsController } from "./admin-invitations.controller";
import { AdminJobsController } from "./admin-jobs.controller";
import { AdminOverviewService } from "./admin-overview.service";
import { AdminPushController } from "./admin-push.controller";
import { AdminReportsController } from "./admin-reports.controller";
import { AdminSecurityController } from "./admin-security.controller";
import { AdminSocialStatsService } from "./admin-social-stats.service";
import { AdminStatsController } from "./admin-stats.controller";
import { AdminSystemStatsService } from "./admin-system-stats.service";
import { AdminSystemController } from "./admin-system.controller";
import { AdminUsersController } from "./admin-users.controller";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";
import { BackupService } from "./backup.service";
import { PublicStatsController } from "./public-stats.controller";
import { PublicStatsGuard } from "./public-stats.guard";
import { QuotaAlertService } from "./quota-alert.service";

@Module({
  imports: [
    ApiKeysModule,
    MailModule,
    NotificationModule,
    AdminAlertModule,
    AuthModule,
    CatalogModule,
    GamesModule,
    BooksModule,
    MusicModule,
    JobsModule,
    ImportModule,
    SecurityModule,
    UsersModule,
    ReportsModule,
    CommentsModule,
    ChatModule,
    ReviewsModule,
    SocialModule,
    ListsModule,
    GamificationModule,
  ],
  controllers: [
    AdminInstanceSettingsController,
    AdminSystemController,
    AdminSecurityController,
    AdminJobsController,
    AdminUsersController,
    AdminInvitationsController,
    AdminEmailsController,
    AdminPushController,
    AdminCacheController,
    AdminImportsController,
    AdminReportsController,
    AdminStatsController,
    PublicStatsController,
  ],
  providers: [
    QuotaAlertService,
    AdminService,
    AdminGuard,
    PublicStatsGuard,
    AdminOverviewService,
    AdminAccountsStatsService,
    AdminCatalogueStatsService,
    AdminSocialStatsService,
    AdminSystemStatsService,
    BackupService,
  ],
})
export class AdminModule {}
