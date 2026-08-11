import { ArrayNotEmpty, IsArray, IsISO8601, IsString } from "class-validator";

/**
 * Full replacement order — every item id of the list, new order first.
 * `expectedUpdatedAt` is the optimistic lock (see ReorderListItemsDto).
 */
export class ReorderListItemsBody {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedItemIds!: string[];

  @IsISO8601()
  expectedUpdatedAt!: string;
}
