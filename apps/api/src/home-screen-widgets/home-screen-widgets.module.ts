import { Module } from "@nestjs/common";
import { GamificationModule } from "../gamification/gamification.module";
import { LibraryModule } from "../library/library.module";
import { SessionTimerModule } from "../session-timer/session-timer.module";
import { DomainGateModule } from "../users/domain-gate.module";
import { HomeScreenWidgetsController } from "./home-screen-widgets.controller";
import { HomeScreenWidgetsService } from "./home-screen-widgets.service";

@Module({
  imports: [
    LibraryModule,
    DomainGateModule,
    SessionTimerModule,
    GamificationModule,
  ],
  controllers: [HomeScreenWidgetsController],
  providers: [HomeScreenWidgetsService],
})
export class HomeScreenWidgetsModule {}
