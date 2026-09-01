import { Module } from "@nestjs/common";
import { GamificationModule } from "../gamification/gamification.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { UsersModule } from "../users/users.module";
import { GameItemService } from "./game-item.service";
import { GameLibraryService } from "./game-library.service";
import { GamesController } from "./games.controller";
import { IgdbProvider } from "./providers/igdb.provider";

// Import flows live in the generic ImportModule (its Steam source reuses
// GameItemService + IgdbProvider, hence the exports).
@Module({
  imports: [UsersModule, ReviewsModule, GamificationModule],
  controllers: [GamesController],
  providers: [GameItemService, GameLibraryService, IgdbProvider],
  exports: [GameItemService, IgdbProvider],
})
export class GamesModule {}
