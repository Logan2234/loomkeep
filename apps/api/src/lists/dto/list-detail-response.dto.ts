import type { ListDetailDto, ListViewerRole } from "@loomkeep/shared";
import { ListItemResponseDto } from "./list-item-response.dto";
import { ListResponseDto } from "./list-response.dto";

export class ListDetailResponseDto
  extends ListResponseDto
  implements ListDetailDto
{
  items!: ListItemResponseDto[];
  viewerRole!: ListViewerRole;
}
