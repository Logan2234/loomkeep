import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { GamificationModule } from "../gamification/gamification.module";
import { ListsModule } from "../lists/lists.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { UserGatesModule } from "../users/user-gates.module";
import { MusicDomainAdapter } from "./music-domain.adapter";
import { MusicItemService } from "./music-item.service";
import { MusicLibraryService } from "./music-library.service";
import { MusicController } from "./music.controller";
import { MusicBrainzProvider } from "./providers/musicbrainz.provider";

@Module({
  imports: [
    UserGatesModule,
    ReviewsModule,
    GamificationModule,
    ListsModule,
    EventsModule,
  ],
  controllers: [MusicController],
  providers: [
    MusicDomainAdapter,
    MusicItemService,
    MusicLibraryService,
    MusicBrainzProvider,
  ],
  exports: [
    MusicDomainAdapter,
    MusicItemService,
    MusicLibraryService,
    MusicBrainzProvider,
  ],
})
export class MusicModule {}
