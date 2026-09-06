import type { ListItemTargetType } from "@loomkeep/shared";
import { IsIn, IsString } from "class-validator";

// Work-level only — narrower than ReviewTargetType/CommentTargetType, whose
// enum values are reused here, but SEASON/EPISODE aren't valid list items.
const LIST_ITEM_TARGET_TYPES: ListItemTargetType[] = [
  "MEDIA",
  "GAME",
  "BOOK",
];

export class AddListItemBody {
  @IsIn(LIST_ITEM_TARGET_TYPES)
  targetType!: ListItemTargetType;

  @IsString()
  targetId!: string;
}
