import type { HomeLayoutDto, HomeWidgetType } from "@loomkeep/shared";
import {
  HOME_GRID_COLUMNS,
  HOME_LAYOUT_LIMITS,
  HOME_WIDGET_TYPES,
} from "@loomkeep/shared";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

class HomeQuickLinkBody {
  @IsIn(["app", "url"])
  kind!: "app" | "url";

  // A web navigation id; unknown ones are dropped at render time, like the
  // mobile bottom-bar shortcuts.
  @ValidateIf((link: HomeQuickLinkBody) => link.kind === "app")
  @Matches(/^[a-z-]{1,32}$/)
  id?: string;

  // http(s) only: the address ends up as an href on the user's home page.
  @ValidateIf((link: HomeQuickLinkBody) => link.kind === "url")
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(HOME_LAYOUT_LIMITS.urlLength)
  url?: string;

  @ValidateIf((link: HomeQuickLinkBody) => link.kind === "url")
  @IsString()
  @MinLength(1)
  @MaxLength(HOME_LAYOUT_LIMITS.labelLength)
  label?: string;
}

class HomeWidgetConfigBody {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(HOME_LAYOUT_LIMITS.quickLinks)
  @ValidateNested({ each: true })
  @Type(() => HomeQuickLinkBody)
  links?: HomeQuickLinkBody[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  listId?: string;
}

class HomeWidgetBody {
  @Matches(/^[\w-]{1,36}$/)
  id!: string;

  @IsIn(HOME_WIDGET_TYPES)
  type!: HomeWidgetType;

  @IsInt()
  @Min(0)
  @Max(HOME_GRID_COLUMNS - 1)
  x!: number;

  @IsInt()
  @Min(0)
  @Max(HOME_LAYOUT_LIMITS.maxRow)
  y!: number;

  @IsInt()
  @Min(1)
  @Max(HOME_GRID_COLUMNS)
  w!: number;

  @IsInt()
  @Min(1)
  @Max(HOME_LAYOUT_LIMITS.maxHeight)
  h!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => HomeWidgetConfigBody)
  config?: HomeWidgetConfigBody;
}

// Each kind's size bounds live on the web, which clamps at render time; the
// API only keeps a layout inside the grid.
export class HomeLayoutBody implements HomeLayoutDto {
  @IsArray()
  @ArrayMaxSize(HOME_LAYOUT_LIMITS.widgets)
  @ValidateNested({ each: true })
  @Type(() => HomeWidgetBody)
  widgets!: HomeWidgetBody[];
}
