import { Module } from "@nestjs/common";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { BooksModule } from "../books/books.module";
import { CatalogModule } from "../catalog/catalog.module";
import { GamesModule } from "../games/games.module";
import { GamificationModule } from "../gamification/gamification.module";
import { LibraryModule } from "../library/library.module";
import { ListsModule } from "../lists/list.module";
import { MusicModule } from "../music/music.module";
import { NotificationModule } from "../notifications/notification.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { StatsModule } from "../stats/stats.module";
import { UsersModule } from "../users/users.module";
import {
  ExportV1Controller,
  ListsV1Controller,
  NotificationsV1Controller,
  ProfileV1Controller,
  ReviewsV1Controller,
  StatsV1Controller,
} from "./v1/controllers/account.controller";
import {
  CalendarV1Controller,
  HistoryV1Controller,
  LibraryV1Controller,
} from "./v1/controllers/library.controller";
import { HistoryV1Service } from "./v1/history-v1.service";
import { LibraryV1Service } from "./v1/library-v1.service";
import { ListsV1Service } from "./v1/lists-v1.service";
import { MeV1Controller } from "./v1/me.controller";
import { MeV1Service } from "./v1/me.service";
import { ProfileV1Service } from "./v1/profile-v1.service";
import { StatsV1Service } from "./v1/stats-v1.service";
import { WorkTitlesService } from "./v1/work-titles.service";

/**
 * The versioned public API (`/api/v1`), the only surface API keys reach.
 * Its controllers map internal services onto the public DTOs of
 * `@loomkeep/shared`'s `api-v1.ts`, never exposing an internal DTO as is.
 */
@Module({
  imports: [
    ApiKeysModule,
    UsersModule,
    LibraryModule,
    GamesModule,
    BooksModule,
    MusicModule,
    CatalogModule,
    ListsModule,
    StatsModule,
    ReviewsModule,
    GamificationModule,
    NotificationModule,
  ],
  controllers: [
    MeV1Controller,
    LibraryV1Controller,
    CalendarV1Controller,
    HistoryV1Controller,
    ListsV1Controller,
    StatsV1Controller,
    ReviewsV1Controller,
    ProfileV1Controller,
    NotificationsV1Controller,
    ExportV1Controller,
  ],
  providers: [
    MeV1Service,
    LibraryV1Service,
    ListsV1Service,
    StatsV1Service,
    ProfileV1Service,
    HistoryV1Service,
    WorkTitlesService,
  ],
})
export class PublicApiModule {}
