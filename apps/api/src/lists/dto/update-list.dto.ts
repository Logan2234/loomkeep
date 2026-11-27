import type { UpdateListDto } from "@loomkeep/shared/contracts";
import { LIST_LIMITS } from "@loomkeep/shared/contracts";
import {
  ListKind,
  type ListKind as ListKindT,
  type ListVisibility,
  ListVisibility as ListVisibilityEnum,
} from "@loomkeep/shared/enums";
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateListBody implements UpdateListDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(LIST_LIMITS.title)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIST_LIMITS.description)
  description?: string | null;

  @IsOptional()
  @IsIn(Object.values(ListVisibilityEnum))
  visibility?: ListVisibility;

  @IsOptional()
  @IsIn(Object.values(ListKind))
  kind?: ListKindT;
}
