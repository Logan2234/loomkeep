import { Module } from "@nestjs/common";
import { LibraryModule } from "../library/library.module";
import { DomainGateModule } from "../users/domain-gate.module";
import { HomeScreenWidgetsController } from "./home-screen-widgets.controller";
import { HomeScreenWidgetsService } from "./home-screen-widgets.service";

@Module({
  imports: [LibraryModule, DomainGateModule],
  controllers: [HomeScreenWidgetsController],
  providers: [HomeScreenWidgetsService],
})
export class HomeScreenWidgetsModule {}
