import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { EventsModule } from "../events/events.module";
import { GamificationModule } from "../gamification/gamification.module";
import { ListsModule } from "../lists/lists.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { UserGatesModule } from "../users/user-gates.module";
import { CalendarService } from "./calendar.service";
import { LibraryController } from "./library.controller";
import { LibraryService } from "./library.service";
import { MediaController } from "./media.controller";
import { SagaService } from "./saga.service";

@Module({
  imports: [
    CatalogModule,
    UserGatesModule,
    ReviewsModule,
    GamificationModule,
    ListsModule,
    EventsModule,
  ],
  controllers: [LibraryController, MediaController],
  providers: [LibraryService, SagaService, CalendarService],
  exports: [LibraryService, SagaService, CalendarService],
})
export class LibraryModule {}
