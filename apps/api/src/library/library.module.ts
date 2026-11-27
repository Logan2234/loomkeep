import { Module } from "@nestjs/common";
import { CalendarService } from "./calendar.service";
import { LibraryController } from "./library.controller";
import { LibraryService } from "./library.service";

/**
 * The library across domains (counts per domain, the release calendar of
 * media and games). Each domain's own library lives in its module: media/,
 * games/, books/, music/.
 */
@Module({
  controllers: [LibraryController],
  providers: [LibraryService, CalendarService],
  exports: [CalendarService],
})
export class LibraryModule {}
