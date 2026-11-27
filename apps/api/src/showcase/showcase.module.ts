import { Module } from "@nestjs/common";
import { GamesModule } from "../games/games.module";
import { MediaModule } from "../media/media.module";
import { ShowcaseController } from "./showcase.controller";
import { ShowcaseService } from "./showcase.service";

@Module({
  imports: [MediaModule, GamesModule],
  controllers: [ShowcaseController],
  providers: [ShowcaseService],
})
export class ShowcaseModule {}
