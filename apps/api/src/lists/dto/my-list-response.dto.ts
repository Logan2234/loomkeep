import type { ListViewerRole, MyListDto } from "@loomkeep/shared";
import { ListResponseDto } from "./list-response.dto";

export class MyListResponseDto extends ListResponseDto implements MyListDto {
  itemCount!: number;
  previewImageUrls!: string[];
  role!: Extract<ListViewerRole, "OWNER" | "EDITOR">;
}
