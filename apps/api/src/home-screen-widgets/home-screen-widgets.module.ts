import { Module } from "@nestjs/common";
import { GamificationModule } from "../gamification/gamification.module";
import { LibraryModule } from "../library/library.module";
import { MediaModule } from "../media/media.module";
import { SessionTimerModule } from "../session-timer/session-timer.module";
import { UserGatesModule } from "../users/user-gates.module";
import { HomeScreenWidgetsController } from "./home-screen-widgets.controller";
import { HomeScreenWidgetsService } from "./home-screen-widgets.service";

@Module({
  imports: [
    LibraryModule,
    MediaModule,
    UserGatesModule,
    SessionTimerModule,
    GamificationModule,
  ],
  controllers: [HomeScreenWidgetsController],
  providers: [HomeScreenWidgetsService],
})
export class HomeScreenWidgetsModule {}
