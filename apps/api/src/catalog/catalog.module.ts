import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { UsersModule } from "../users/users.module";
import { AnimeMigrationService } from "./anime-migration.service";
import { CatalogController } from "./catalog.controller";
import { MediaItemService } from "./media-item.service";
import { OmdbService } from "./omdb.service";
import { TmdbProvider } from "./providers/tmdb.provider";
import { SagaSyncService } from "./saga-sync.service";

@Module({
  imports: [UsersModule, JobsModule],
  controllers: [CatalogController],
  providers: [
    MediaItemService,
    TmdbProvider,
    OmdbService,
    SagaSyncService,
    AnimeMigrationService,
  ],
  // Providers are exported for import reconciliation (TVDB → TMDB for TV
  // Time, MAL titles → TMDB).
  exports: [MediaItemService, TmdbProvider, SagaSyncService],
})
export class CatalogModule {}
