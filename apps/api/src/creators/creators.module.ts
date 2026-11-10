import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { CatalogModule } from "../catalog/catalog.module";
import { LibraryModule } from "../library/library.module";
import { UsersModule } from "../users/users.module";
import { CreatorService } from "./creator.service";
import { CreatorsController } from "./creators.controller";

@Module({
  imports: [BooksModule, CatalogModule, LibraryModule, UsersModule],
  controllers: [CreatorsController],
  providers: [CreatorService],
})
export class CreatorsModule {}
