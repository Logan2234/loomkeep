import { Injectable } from "@nestjs/common";
import { BookItemService } from "../../../books/book-item.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReviewService } from "../../../reviews/review.service";
import { AgeGateService } from "../../../users/age-gate.service";
import { parseBabelioCsv, type ParsedBabelioRow } from "./babelio-parse";
import { BookCsvSource } from "./book-csv.source";

@Injectable()
export class BabelioImportSource extends BookCsvSource<ParsedBabelioRow> {
  readonly id = "babelio";

  constructor(
    prisma: PrismaService,
    bookItemService: BookItemService,
    ageGate: AgeGateService,
    reviews: ReviewService,
  ) {
    super(prisma, bookItemService, ageGate, reviews);
  }

  protected parseCsv(csv: string): ParsedBabelioRow[] {
    return parseBabelioCsv(csv);
  }
}
