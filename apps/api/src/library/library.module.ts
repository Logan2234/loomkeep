import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { GamesModule } from "../games/games.module";
import { MediaModule } from "../media/media.module";
import { MusicModule } from "../music/music.module";
import { CalendarService } from "./calendar.service";
import { DomainRegistry } from "./domain-registry";
import { LibraryController } from "./library.controller";
import { LibraryService } from "./library.service";

/**
 * The library across domains: the registry of every domain's adapter, the
 * counts per domain and the release calendar of media and games. Each
 * domain's own library lives in its module: media/, games/, books/, music/.
 */
@Module({
  imports: [MediaModule, GamesModule, BooksModule, MusicModule],
  controllers: [LibraryController],
  providers: [LibraryService, CalendarService, DomainRegistry],
  exports: [CalendarService, DomainRegistry],
})
export class LibraryModule {}
