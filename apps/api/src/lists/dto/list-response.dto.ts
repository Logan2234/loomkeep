import type { ListDto, ListKind, ListVisibility } from "@loomkeep/shared";
import { UserSummaryResponseDto } from "../../common/dto/user-summary-response.dto";

export class ListResponseDto implements ListDto {
  id!: string;
  title!: string;
  description!: string | null;
  kind!: ListKind;
  visibility!: ListVisibility;
  createdAt!: string;
  updatedAt!: string;
  author!: UserSummaryResponseDto;
}
