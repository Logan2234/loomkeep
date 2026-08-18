import { Module } from "@nestjs/common";
import { ReviewsModule } from "../reviews/reviews.module";
import { UsersModule } from "../users/users.module";
import { BookItemService } from "./book-item.service";
import { BookLibraryService } from "./book-library.service";
import { BooksController } from "./books.controller";
import { OpenLibraryProvider } from "./providers/open-library.provider";

// Import flows live in the generic ImportModule (its book sources reuse
// BookItemService, hence the export).
@Module({
  imports: [UsersModule, ReviewsModule],
  controllers: [BooksController],
  providers: [BookItemService, BookLibraryService, OpenLibraryProvider],
  exports: [BookItemService],
})
export class BooksModule {}
