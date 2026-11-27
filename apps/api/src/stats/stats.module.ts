import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { GamesModule } from "../games/games.module";
import { LibraryModule } from "../library/library.module";
import { MediaModule } from "../media/media.module";
import { MusicModule } from "../music/music.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { SocialModule } from "../social/social.module";
import { UserGatesModule } from "../users/user-gates.module";
import { HomeStatsController } from "./home-stats.controller";
import { HomeStatsService } from "./home-stats.service";
import { PileService } from "./pile.service";
import { StatsController } from "./stats.controller";
import { StatsService } from "./stats.service";

@Module({
  imports: [
    ReviewsModule,
    UserGatesModule,
    EntitlementsModule,
    MediaModule,
    GamesModule,
    BooksModule,
    MusicModule,
    SocialModule,
    LibraryModule,
  ],
  controllers: [StatsController, HomeStatsController],
  providers: [StatsService, HomeStatsService, PileService],
  exports: [StatsService],
})
export class StatsModule {}
