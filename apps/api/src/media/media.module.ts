import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { GamificationModule } from "../gamification/gamification.module";
import { JobsModule } from "../jobs/jobs.module";
import { ListsModule } from "../lists/lists.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { UserGatesModule } from "../users/user-gates.module";
import { MediaCatalogController } from "./media-catalog.controller";
import { MediaItemService } from "./media-item.service";
import { MediaLibraryController } from "./media-library.controller";
import { MediaLibraryService } from "./media-library.service";
import { MediaSagaService } from "./media-saga.service";
import { MediaController } from "./media.controller";
import { OmdbService } from "./omdb.service";
import { AnilistProvider } from "./providers/anilist.provider";
import { TmdbProvider } from "./providers/tmdb.provider";
import { SagaSyncService } from "./saga-sync.service";

/**
 * Series, films and anime: their catalogue cache (TMDB, AniList, OMDb),
 * what users track of it (entries, episode watches, replays) and their sagas.
 */
@Module({
  imports: [
    UserGatesModule,
    JobsModule,
    ReviewsModule,
    GamificationModule,
    ListsModule,
    EventsModule,
  ],
  controllers: [
    MediaCatalogController,
    MediaLibraryController,
    MediaController,
  ],
  providers: [
    MediaItemService,
    TmdbProvider,
    AnilistProvider,
    OmdbService,
    SagaSyncService,
    MediaLibraryService,
    MediaSagaService,
  ],
  // The providers are exported for import reconciliation; each source keeps
  // its catalogue boundary explicit (TVDB → TMDB for TV Time, MAL → AniList).
  exports: [
    MediaItemService,
    TmdbProvider,
    AnilistProvider,
    SagaSyncService,
    MediaLibraryService,
    MediaSagaService,
  ],
})
export class MediaModule {}
