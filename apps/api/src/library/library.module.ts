import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { EventsModule } from "../events/events.module";
import { GamificationModule } from "../gamification/gamification.module";
import { ListsModule } from "../lists/list.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { UsersModule } from "../users/users.module";
import { LibraryController } from "./library.controller";
import { LibraryService } from "./library.service";
import { MediaController } from "./media.controller";
import { SagaService } from "./saga.service";

@Module({
  imports: [
    CatalogModule,
    UsersModule,
    ReviewsModule,
    GamificationModule,
    ListsModule,
    EventsModule,
  ],
  controllers: [LibraryController, MediaController],
  providers: [LibraryService, SagaService],
  exports: [LibraryService],
})
export class LibraryModule {}
