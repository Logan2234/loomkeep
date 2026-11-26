import { Module } from "@nestjs/common";
import { AccountModule } from "../account/account.module";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { AuthModule } from "../auth/auth.module";
import { BooksModule } from "../books/books.module";
import { CatalogModule } from "../catalog/catalog.module";
import { ChatModule } from "../chat/chat.module";
import { CommentsModule } from "../comments/comments.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { EventsModule } from "../events/events.module";
import { GamesModule } from "../games/games.module";
import { GamificationModule } from "../gamification/gamification.module";
import { ImportModule } from "../import/import.module";
import { JobsModule } from "../jobs/jobs.module";
import { ListsModule } from "../lists/lists.module";
import { MailModule } from "../mail/mail.module";
import { MusicModule } from "../music/music.module";
import { AdminAlertModule } from "../notifications/admin-alert.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ReportsModule } from "../reports/reports.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { SecurityModule } from "../security/security.module";
import { SocialModule } from "../social/social.module";
import { UserGatesModule } from "../users/user-gates.module";
import { AdminAccountsStatsService } from "./admin-accounts-stats.service";
import { AdminCacheController } from "./admin-cache.controller";
import { AdminCacheService } from "./admin-cache.service";
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
import { AdminUsersService } from "./admin-users.service";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";
import { BackupService } from "./backup.service";
import { InstancePingController } from "./instance-ping.controller";
import { InstancePingService } from "./instance-ping.service";
import { PublicStatsController } from "./public-stats.controller";
import { PublicStatsGuard } from "./public-stats.guard";
import { QuotaAlertService } from "./quota-alert.service";
import { UpdateCheckService } from "./update-check.service";

@Module({
  imports: [
    EntitlementsModule,
    ApiKeysModule,
    MailModule,
    NotificationsModule,
    AdminAlertModule,
    AuthModule,
    CatalogModule,
    GamesModule,
    BooksModule,
    MusicModule,
    JobsModule,
    ImportModule,
    SecurityModule,
    AccountModule,
    UserGatesModule,
    ReportsModule,
    CommentsModule,
    ChatModule,
    EventsModule,
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
    InstancePingController,
  ],
  providers: [
    QuotaAlertService,
    AdminService,
    AdminCacheService,
    AdminGuard,
    PublicStatsGuard,
    AdminOverviewService,
    AdminUsersService,
    AdminAccountsStatsService,
    AdminCatalogueStatsService,
    AdminSocialStatsService,
    AdminSystemStatsService,
    BackupService,
    UpdateCheckService,
    InstancePingService,
  ],
})
export class AdminModule {}
