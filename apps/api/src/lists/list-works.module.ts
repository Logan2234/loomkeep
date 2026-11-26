import { Module } from "@nestjs/common";
import { LinksModule } from "../links/links.module";
import { UserGatesModule } from "../users/user-gates.module";
import { ListWorksController } from "./list-works.controller";
import { ListsModule } from "./lists.module";

@Module({
  imports: [ListsModule, LinksModule, UserGatesModule],
  controllers: [ListWorksController],
})
export class ListWorksModule {}
