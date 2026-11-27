import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { GamesModule } from "../games/games.module";
import { MediaModule } from "../media/media.module";
import { MusicModule } from "../music/music.module";
import { LinkResolverService } from "./link-resolver.service";
import { LinksController } from "./links.controller";
import { WorkPageService } from "./work-page.service";

@Module({
  imports: [MediaModule, GamesModule, BooksModule, MusicModule],
  controllers: [LinksController],
  providers: [LinkResolverService, WorkPageService],
  exports: [LinkResolverService, WorkPageService],
})
export class LinksModule {}
