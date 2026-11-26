import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { GamificationModule } from "../gamification/gamification.module";
import { JobsModule } from "../jobs/jobs.module";
import { ListsModule } from "../lists/lists.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { UserGatesModule } from "../users/user-gates.module";
import { GameItemService } from "./game-item.service";
import { GameLibraryService } from "./game-library.service";
import { GameSagaService } from "./game-saga.service";
import { GameSessionService } from "./game-session.service";
import { GamesController } from "./games.controller";
import { IgdbProvider } from "./providers/igdb.provider";

// Import flows live in the generic ImportModule (its Steam source reuses
// GameItemService + IgdbProvider, hence the exports).
@Module({
  imports: [
    UserGatesModule,
    ReviewsModule,
    GamificationModule,
    ListsModule,
    EventsModule,
    JobsModule,
  ],
  controllers: [GamesController],
  providers: [
    GameItemService,
    GameLibraryService,
    GameSagaService,
    GameSessionService,
    IgdbProvider,
  ],
  exports: [
    GameItemService,
    GameLibraryService,
    GameSessionService,
    GameSagaService,
    IgdbProvider,
  ],
})
export class GamesModule {}
