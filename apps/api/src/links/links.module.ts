import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { CatalogModule } from "../catalog/catalog.module";
import { GamesModule } from "../games/games.module";
import { MusicModule } from "../music/music.module";
import { LinkResolverService } from "./link-resolver.service";
import { LinksController } from "./links.controller";

@Module({
  imports: [CatalogModule, GamesModule, BooksModule, MusicModule],
  controllers: [LinksController],
  providers: [LinkResolverService],
})
export class LinksModule {}
