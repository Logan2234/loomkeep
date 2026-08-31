import type { FollowRequestDto } from "@loomkeep/shared";
import { UserSummaryResponseDto } from "../../common/dto/user-summary-response.dto";

export class FollowRequestResponseDto implements FollowRequestDto {
  id!: string;
  user!: UserSummaryResponseDto;
  createdAt!: string;
}
