import {
  LIST_LIMITS,
  ListKind,
  type ListKind as ListKindT,
  type ListVisibility,
  ListVisibility as ListVisibilityEnum,
} from "@loomkeep/shared";
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateListBody {
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
