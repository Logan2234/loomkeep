import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { BooksModule } from "./books/books.module";
import { CatalogModule } from "./catalog/catalog.module";
import { CommentsModule } from "./comments/comments.module";
import { CommonModule } from "./common/common.module";
import { RuntimeConfigModule } from "./config/config.module";
import { GamesModule } from "./games/games.module";
import { HealthModule } from "./health/health.module";
import { ImportModule } from "./import/import.module";
import { LibraryModule } from "./library/library.module";
import { ListsModule } from "./lists/list.module";
import { MailModule } from "./mail/mail.module";
import { MusicModule } from "./music/music.module";
import { NotificationModule } from "./notifications/notification.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { SocialModule } from "./social/social.module";
import { StatsModule } from "./stats/stats.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Default: 60 req/min per IP for the whole API. Sensitive auth routes
    // (login, register, forgot/reset password) apply a tighter @Throttle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    CommonModule,
    RuntimeConfigModule,
    MailModule,
    AuthModule,
    AdminModule,
    UsersModule,
    CatalogModule,
    GamesModule,
    BooksModule,
    MusicModule,
    LibraryModule,
    ImportModule,
    NotificationModule,
    HealthModule,
    SocialModule,
    ReviewsModule,
    CommentsModule,
    ListsModule,
    StatsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
