import type { ApiV1ListDetailDto } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
import { ApiV1ListItemResponseDto } from "./api-v1-list-item-response.dto";
import { ApiV1ListResponseDto } from "./api-v1-list-response.dto";
export class ApiV1ListDetailResponseDto
  extends ApiV1ListResponseDto
  implements ApiV1ListDetailDto
{
  /** The list's items, in their order. */
  @ApiProperty({ type: ApiV1ListItemResponseDto, isArray: true })
  items!: ApiV1ListItemResponseDto[];
}
