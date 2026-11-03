import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { GamesModule } from "../games/games.module";
import { ShowcaseController } from "./showcase.controller";
import { ShowcaseService } from "./showcase.service";

@Module({
  imports: [CatalogModule, GamesModule],
  controllers: [ShowcaseController],
  providers: [ShowcaseService],
})
export class ShowcaseModule {}
