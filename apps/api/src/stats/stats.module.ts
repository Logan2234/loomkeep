import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { EntitlementModule } from "../entitlements/entitlement.module";
import { GamesModule } from "../games/games.module";
import { LibraryModule } from "../library/library.module";
import { MusicModule } from "../music/music.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { UsersModule } from "../users/users.module";
import { HomeStatsController } from "./home-stats.controller";
import { HomeStatsService } from "./home-stats.service";
import { PileService } from "./pile.service";
import { StatsController } from "./stats.controller";
import { StatsService } from "./stats.service";

@Module({
  imports: [
    ReviewsModule,
    UsersModule,
    EntitlementModule,
    LibraryModule,
    GamesModule,
    BooksModule,
    MusicModule,
  ],
  controllers: [StatsController, HomeStatsController],
  providers: [StatsService, HomeStatsService, PileService],
  exports: [StatsService],
})
export class StatsModule {}
