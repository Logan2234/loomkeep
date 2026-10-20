import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { UsersModule } from "../users/users.module";
import { CatalogController } from "./catalog.controller";
import { MediaItemService } from "./media-item.service";
import { OmdbService } from "./omdb.service";
import { AnilistProvider } from "./providers/anilist.provider";
import { TmdbProvider } from "./providers/tmdb.provider";
import { SagaSyncService } from "./saga-sync.service";

@Module({
  imports: [UsersModule, JobsModule],
  controllers: [CatalogController],
  providers: [
    MediaItemService,
    TmdbProvider,
    AnilistProvider,
    OmdbService,
    SagaSyncService,
  ],
  // Providers are exported for import reconciliation; each source keeps its
  // catalogue boundary explicit (TVDB → TMDB for TV Time, MAL → AniList).
  exports: [MediaItemService, TmdbProvider, AnilistProvider, SagaSyncService],
})
export class CatalogModule {}
