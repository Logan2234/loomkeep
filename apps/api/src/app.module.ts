import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { BooksModule } from "./books/books.module";
import { CatalogModule } from "./catalog/catalog.module";
import { CommentsModule } from "./comments/comments.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { CommonModule } from "./common/common.module";
import { loggerOptions } from "./common/logger.config";
import { RuntimeConfigModule } from "./config/config.module";
import { validateEnv } from "./config/env.validation";
import { FeatureFlagsModule } from "./feature-flags/feature-flags.module";
import { GamesModule } from "./games/games.module";
import { HealthModule } from "./health/health.module";
import { ImportModule } from "./import/import.module";
import { LibraryModule } from "./library/library.module";
import { ListsModule } from "./lists/list.module";
import { MailModule } from "./mail/mail.module";
import { MusicModule } from "./music/music.module";
import { NewsletterModule } from "./newsletter/newsletter.module";
import { NotificationModule } from "./notifications/notification.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { SocialModule } from "./social/social.module";
import { StatsModule } from "./stats/stats.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    // apps/api/.env only needs to hold the values that must differ from the
    // Docker deployment (NODE_ENV, DATABASE_URL, WEB_ORIGIN); everything
    // else (provider API keys, JWT secrets, SMTP, LOG_LEVEL...) is read from
    // the repo-root .env, the same file docker-compose.yml interpolates from.
    // First match wins, so apps/api/.env can still override a root value.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
      validate: validateEnv,
    }),
    LoggerModule.forRoot(loggerOptions),
    ScheduleModule.forRoot(),
    // Default: 60 req/min per IP for the whole API. Sensitive auth routes
    // (login, register, forgot/reset password) apply a tighter @Throttle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    CommonModule,
    FeatureFlagsModule,
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
    NewsletterModule,
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
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
