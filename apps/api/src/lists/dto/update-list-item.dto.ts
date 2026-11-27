import {
  LIST_LIMITS,
  type UpdateListItemDto,
} from "@loomkeep/shared/contracts";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateListItemBody implements UpdateListItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(LIST_LIMITS.itemNote)
  note!: string | null;
}
