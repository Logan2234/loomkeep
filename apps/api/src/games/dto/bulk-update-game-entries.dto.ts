import { GameOwnershipStatus, GameStatus } from "@loomkeep/shared";
import { IsIn, IsOptional } from "class-validator";
import { BulkUpdateEntriesBaseBody } from "../../common/dto/bulk-entries.dto";

export class BulkUpdateGameEntriesBody extends BulkUpdateEntriesBaseBody {
  @IsOptional()
  @IsIn(Object.values(GameStatus))
  status?: GameStatus;

  @IsOptional()
  @IsIn(Object.values(GameOwnershipStatus))
  ownershipStatus?: GameOwnershipStatus;
}
