import { Locale } from "@loomkeep/shared";
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class WorkSearchQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;

  /** `local`: only what the instance already knows, for a first answer. */
  @IsOptional()
  @IsIn(["local", "all"])
  scope?: "local" | "all";

  // The client's active UI locale, for titles in that language.
  @IsOptional()
  @IsIn(Locale)
  lang?: string;
}
