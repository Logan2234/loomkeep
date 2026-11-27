import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { GamesModule } from "../games/games.module";
import { MediaModule } from "../media/media.module";
import { MusicModule } from "../music/music.module";
import { UserGatesModule } from "../users/user-gates.module";
import { WorkSearchController } from "./work-search.controller";
import { WorkSearchService } from "./work-search.service";

@Module({
  imports: [
    MediaModule,
    GamesModule,
    BooksModule,
    MusicModule,
    UserGatesModule,
  ],
  controllers: [WorkSearchController],
  providers: [WorkSearchService],
})
export class SearchModule {}
