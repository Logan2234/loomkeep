import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { LibraryModule } from "../library/library.module";
import { UsersModule } from "../users/users.module";
import { CreatorService } from "./creator.service";
import { CreatorsController } from "./creators.controller";

@Module({
  imports: [CatalogModule, LibraryModule, UsersModule],
  controllers: [CreatorsController],
  providers: [CreatorService],
})
export class CreatorsModule {}
