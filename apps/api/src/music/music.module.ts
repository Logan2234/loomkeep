import { Module } from "@nestjs/common";
import { GamificationModule } from "../gamification/gamification.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { UsersModule } from "../users/users.module";
import { MusicItemService } from "./music-item.service";
import { MusicLibraryService } from "./music-library.service";
import { MusicController } from "./music.controller";
import { MusicBrainzProvider } from "./providers/musicbrainz.provider";

@Module({
  imports: [UsersModule, ReviewsModule, GamificationModule],
  controllers: [MusicController],
  providers: [MusicItemService, MusicLibraryService, MusicBrainzProvider],
  exports: [MusicItemService],
})
export class MusicModule {}
