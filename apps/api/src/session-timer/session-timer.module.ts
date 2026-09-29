import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { GamesModule } from "../games/games.module";
import { SessionTimerController } from "./session-timer.controller";
import { SessionTimerService } from "./session-timer.service";

@Module({
  imports: [BooksModule, GamesModule],
  controllers: [SessionTimerController],
  providers: [SessionTimerService],
})
export class SessionTimerModule {}
