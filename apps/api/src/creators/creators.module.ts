import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { CatalogModule } from "../catalog/catalog.module";
import { LibraryModule } from "../library/library.module";
import { UserGatesModule } from "../users/user-gates.module";
import { CreatorService } from "./creator.service";
import { CreatorsController } from "./creators.controller";

@Module({
  imports: [BooksModule, CatalogModule, LibraryModule, UserGatesModule],
  controllers: [CreatorsController],
  providers: [CreatorService],
})
export class CreatorsModule {}
