import type { BulkUpdateEntriesDto } from "@loomkeep/shared/contracts";
import { BookOwnershipStatus, BookStatus } from "@loomkeep/shared/enums";
import { IsIn, IsOptional } from "class-validator";
import { BulkUpdateEntriesBaseBody } from "../../work/dto/bulk-entries.dto";

export class BulkUpdateBookEntriesBody
  extends BulkUpdateEntriesBaseBody
  implements BulkUpdateEntriesDto
{
  @IsOptional()
  @IsIn(Object.values(BookStatus))
  status?: BookStatus;

  @IsOptional()
  @IsIn(Object.values(BookOwnershipStatus))
  ownershipStatus?: BookOwnershipStatus;
}
