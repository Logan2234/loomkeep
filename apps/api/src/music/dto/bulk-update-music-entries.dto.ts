import { MusicOwnershipStatus, MusicStatus } from "@loomkeep/shared";
import { IsIn, IsOptional } from "class-validator";
import { BulkUpdateEntriesBaseBody } from "../../common/dto/bulk-entries.dto";

export class BulkUpdateMusicEntriesBody extends BulkUpdateEntriesBaseBody {
  @IsOptional()
  @IsIn(Object.values(MusicStatus))
  status?: MusicStatus;

  @IsOptional()
  @IsIn(Object.values(MusicOwnershipStatus))
  ownershipStatus?: MusicOwnershipStatus;
}
