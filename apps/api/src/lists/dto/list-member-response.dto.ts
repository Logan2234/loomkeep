import type { ListMemberDto } from "@loomkeep/shared";
import { UserSummaryResponseDto } from "../../common/dto/user-summary-response.dto";

export class ListMemberResponseDto implements ListMemberDto {
  user!: UserSummaryResponseDto;
  createdAt!: string;
}
