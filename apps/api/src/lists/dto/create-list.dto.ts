import {
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

export class CreateListBody {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsIn(Object.values(ListKind))
  kind!: ListKindT;

  @IsOptional()
  @IsIn(Object.values(ListVisibilityEnum))
  visibility?: ListVisibility;
}
