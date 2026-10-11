import { Module } from "@nestjs/common";
import { LinksModule } from "../links/links.module";
import { ListWorksController } from "./list-works.controller";
import { ListsModule } from "./list.module";

@Module({
  imports: [ListsModule, LinksModule],
  controllers: [ListWorksController],
})
export class ListWorksModule {}
