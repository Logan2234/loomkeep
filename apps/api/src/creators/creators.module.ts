import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { MediaModule } from "../media/media.module";
import { UserGatesModule } from "../users/user-gates.module";
import { CreatorService } from "./creator.service";
import { CreatorsController } from "./creators.controller";

@Module({
  imports: [BooksModule, MediaModule, UserGatesModule],
  controllers: [CreatorsController],
  providers: [CreatorService],
})
export class CreatorsModule {}
