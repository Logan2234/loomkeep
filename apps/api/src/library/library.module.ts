import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { GamificationModule } from "../gamification/gamification.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { UsersModule } from "../users/users.module";
import { LibraryController } from "./library.controller";
import { LibraryService } from "./library.service";
import { MediaController } from "./media.controller";

@Module({
  imports: [CatalogModule, UsersModule, ReviewsModule, GamificationModule],
  controllers: [LibraryController, MediaController],
  providers: [LibraryService],
})
export class LibraryModule {}
