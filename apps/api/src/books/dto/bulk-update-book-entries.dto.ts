import { BookOwnershipStatus, BookStatus } from "@loomkeep/shared";
import { IsIn, IsOptional } from "class-validator";
import { BulkUpdateEntriesBaseBody } from "../../common/dto/bulk-entries.dto";

export class BulkUpdateBookEntriesBody extends BulkUpdateEntriesBaseBody {
  @IsOptional()
  @IsIn(Object.values(BookStatus))
  status?: BookStatus;

  @IsOptional()
  @IsIn(Object.values(BookOwnershipStatus))
  ownershipStatus?: BookOwnershipStatus;
}
