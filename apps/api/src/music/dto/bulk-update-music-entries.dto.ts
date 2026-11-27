import type { BulkUpdateEntriesDto } from "@loomkeep/shared/contracts";
import { MusicOwnershipStatus, MusicStatus } from "@loomkeep/shared/enums";
import { IsIn, IsOptional } from "class-validator";
import { BulkUpdateEntriesBaseBody } from "../../work/dto/bulk-entries.dto";

export class BulkUpdateMusicEntriesBody
  extends BulkUpdateEntriesBaseBody
  implements BulkUpdateEntriesDto
{
  @IsOptional()
  @IsIn(Object.values(MusicStatus))
  status?: MusicStatus;

  @IsOptional()
  @IsIn(Object.values(MusicOwnershipStatus))
  ownershipStatus?: MusicOwnershipStatus;
}
