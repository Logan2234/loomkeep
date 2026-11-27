import type { BulkUpdateEntriesDto } from "@loomkeep/shared/contracts";
import { MEDIA_BULK_STATUSES } from "@loomkeep/shared/contracts";
import { MediaOwnershipStatus } from "@loomkeep/shared/enums";
import { IsIn, IsOptional } from "class-validator";
import { BulkUpdateEntriesBaseBody } from "../../work/dto/bulk-entries.dto";

export class BulkUpdateEntriesBody
  extends BulkUpdateEntriesBaseBody
  implements BulkUpdateEntriesDto
{
  @IsOptional()
  @IsIn(MEDIA_BULK_STATUSES)
  status?: (typeof MEDIA_BULK_STATUSES)[number];

  @IsOptional()
  @IsIn(Object.values(MediaOwnershipStatus))
  ownershipStatus?: MediaOwnershipStatus;
}
