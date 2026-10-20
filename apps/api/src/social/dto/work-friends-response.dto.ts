import type {
  WorkFriendDto,
  WorkFriendsDto,
  WorkProgressDto,
} from "@loomkeep/shared";
import { UserSummaryResponseDto } from "../../common/dto/user-summary-response.dto";

export class WorkProgressResponseDto implements WorkProgressDto {
  status!: string;
  season!: number | null;
  episode!: number | null;
  page!: number | null;
  pageCount!: number | null;
  playtimeMinutes!: number | null;
  updatedAt!: string;
}

export class WorkFriendResponseDto
  extends WorkProgressResponseDto
  implements WorkFriendDto
{
  user!: UserSummaryResponseDto;
  rating!: number | null;
}

export class WorkFriendsResponseDto implements WorkFriendsDto {
  friends!: WorkFriendResponseDto[];
  me!: WorkProgressResponseDto | null;
  seasons!: number[];
}
