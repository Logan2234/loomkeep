import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { CatalogModule } from "../catalog/catalog.module";
import { GamesModule } from "../games/games.module";
import { LibraryModule } from "../library/library.module";
import { MusicModule } from "../music/music.module";
import { UsersModule } from "../users/users.module";
import { WorkSearchController } from "./work-search.controller";
import { WorkSearchService } from "./work-search.service";

@Module({
  imports: [
    CatalogModule,
    GamesModule,
    BooksModule,
    MusicModule,
    LibraryModule,
    UsersModule,
  ],
  controllers: [WorkSearchController],
  providers: [WorkSearchService],
})
export class SearchModule {}
