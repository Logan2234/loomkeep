import { MEDIA_BULK_STATUSES, MediaOwnershipStatus } from "@loomkeep/shared";
import { IsIn, IsOptional } from "class-validator";
import { BulkUpdateEntriesBaseBody } from "../../common/dto/bulk-entries.dto";

export class BulkUpdateEntriesBody extends BulkUpdateEntriesBaseBody {
  @IsOptional()
  @IsIn(MEDIA_BULK_STATUSES)
  status?: (typeof MEDIA_BULK_STATUSES)[number];

  @IsOptional()
  @IsIn(Object.values(MediaOwnershipStatus))
  ownershipStatus?: MediaOwnershipStatus;
}
