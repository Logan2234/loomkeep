import type { ConnectionDto } from "@loomkeep/shared";
import { UserSummaryResponseDto } from "../../common/dto/user-summary-response.dto";

export class ConnectionResponseDto
  extends UserSummaryResponseDto
  implements ConnectionDto
{
  following!: boolean;
  requested!: boolean;
  isFriend!: boolean;
}
